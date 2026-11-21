"""FastAPI Entrypoint for FuzzLoad AI Control Plane & Telemetry Streamer."""

from __future__ import annotations

import asyncio
import http.client
import ipaddress
import logging
import os
import socket
import ssl
import urllib.parse
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.cluster.simulator import FuzzLoadClusterController

logger = logging.getLogger(__name__)
controller = FuzzLoadClusterController()
_bg_task: asyncio.Task[None] | None = None


async def _control_plane_loop() -> None:
    """Background coroutine executing the 500ms ANFIS Fast Loop & 6s GP Slow Loop."""
    while True:
        try:
            controller.step_fast_loop(sync_go=True)
        except Exception as exc:
            logger.debug("control plane tick failed: %s", exc)
        await asyncio.sleep(0.5)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _bg_task
    _bg_task = asyncio.create_task(_control_plane_loop())
    try:
        yield
    finally:
        if _bg_task is not None:
            _bg_task.cancel()


app = FastAPI(
    title="FuzzLoad AI Control Plane API",
    description="Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control",
    version="1.0.0",
    lifespan=lifespan,
)

_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://fuzzload.tanisheesh.in")
_allowed_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def _is_disallowed_ip(ip_str: str) -> bool:
    """Return True if the literal IP address is loopback, private, link-local, or reserved."""
    try:
        ip = ipaddress.ip_address(ip_str.strip("[]"))
    except ValueError:
        return True
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _resolve_and_validate_probe_url(raw_url: str) -> tuple[urllib.parse.ParseResult, str, int] | None:
    """Validate probe URL against SSRF, resolve DNS, reject private/loopback IPs, and return pinned IP."""
    try:
        parsed = urllib.parse.urlparse(raw_url)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    if parsed.username or parsed.password:
        return None
    host = parsed.hostname.lower().strip("[]")
    if host in ("localhost", "metadata.google.internal") or host.endswith((".local", ".internal", ".localhost")):
        return None

    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    # Check literal IP directly without DNS lookup
    try:
        ipaddress.ip_address(host)
        if _is_disallowed_ip(host):
            return None
        return parsed, host, port
    except ValueError:
        pass

    # Resolve DNS and verify every returned IP address is public before pinning one
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return None
    if not infos:
        return None

    validated_ip: str | None = None
    for info in infos:
        addr = str(info[4][0])
        if _is_disallowed_ip(addr):
            return None
        if validated_ip is None:
            validated_ip = addr

    if validated_ip is None:
        return None
    return parsed, validated_ip, port


def _is_safe_probe_url(raw_url: str) -> bool:
    """Boolean helper checking literal/hostname safety (without blocking on offline DNS in unit checks)."""
    try:
        parsed = urllib.parse.urlparse(raw_url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    if parsed.username or parsed.password:
        return False
    host = parsed.hostname.lower().strip("[]")
    if host in ("localhost", "metadata.google.internal") or host.endswith((".local", ".internal", ".localhost")):
        return False
    try:
        ipaddress.ip_address(host)
        return not _is_disallowed_ip(host)
    except ValueError:
        return True


def _pinned_http_get_no_redirect(parsed: urllib.parse.ParseResult, pinned_ip: str, port: int, timeout: float = 5.0) -> int:
    """Perform an HTTP/HTTPS GET directly to the DNS-pinned IP without following redirects."""
    hostname = parsed.hostname or pinned_ip
    host_header = hostname if parsed.port is None else f"{hostname}:{port}"
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    conn: http.client.HTTPConnection
    if parsed.scheme == "https":
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        raw_sock = socket.create_connection((pinned_ip, port), timeout=timeout)
        tls_sock = ctx.wrap_socket(raw_sock, server_hostname=hostname)
        conn = http.client.HTTPSConnection(hostname, port=port, timeout=timeout, context=ctx)
        conn.sock = tls_sock
    else:
        conn = http.client.HTTPConnection(pinned_ip, port=port, timeout=timeout)

    try:
        conn.request(
            "GET",
            path,
            headers={
                "Host": host_header,
                "User-Agent": "FuzzLoad-Control-Plane/1.0",
                "Connection": "close",
            },
        )
        resp = conn.getresponse()
        _ = resp.read(4096)
        status = int(resp.status)
        if 300 <= status < 400:
            raise ValueError(f"Redirects are disabled during probing (HTTP {status})")
        return status
    finally:
        conn.close()


class AlgorithmUpdateRequest(BaseModel):
    algorithm: str = Field(..., description="Routing policy identifier")


class TrafficUpdateRequest(BaseModel):
    profile: str = Field(..., description="Traffic pattern profile")
    base_rps: int | None = Field(default=None, ge=60, le=1500)


class ChaosInjectRequest(BaseModel):
    node_id: str = Field(..., description="Target worker node ID")
    fault_type: str = Field(..., description="cpu_spike | mem_leak | io_lag | offline | clear_all")
    enabled: bool = Field(default=True)


class GPEvolveRequest(BaseModel):
    generations: int = Field(default=5, ge=1, le=20)


class ProbeTargetItem(BaseModel):
    id: str
    name: str
    url: str
    cores: float = Field(default=2.0, ge=0.5, le=64.0)


class ProxyProbeRequest(BaseModel):
    requestsPerTarget: int = Field(default=3, ge=1, le=10)
    targets: list[ProbeTargetItem]


@app.get("/api/health")
def get_health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "fuzzload-ai-control-plane",
        "algorithm": controller.algorithm,
        "anfis_epoch": controller.anfis.epoch,
        "gp_generation": controller.gp.generation,
        "go_proxy_connected": controller.go_proxy_connected,
    }


@app.get("/api/state")
def get_state() -> dict[str, Any]:
    return controller.get_full_state()


@app.post("/api/config/algorithm")
def update_algorithm(req: AlgorithmUpdateRequest) -> dict[str, Any]:
    try:
        return controller.set_algorithm(req.algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/config/traffic")
def update_traffic(req: TrafficUpdateRequest) -> dict[str, Any]:
    try:
        return controller.set_traffic_profile(req.profile, req.base_rps)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/chaos/inject")
def inject_chaos(req: ChaosInjectRequest) -> dict[str, Any]:
    try:
        return controller.inject_chaos(req.node_id, req.fault_type, req.enabled)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/gp/evolve")
def evolve_gp(req: GPEvolveRequest) -> dict[str, Any]:
    return controller.trigger_gp_evolution(req.generations)


@app.post("/api/benchmark/run")
def run_benchmark() -> dict[str, Any]:
    results = controller.run_comparative_benchmark()
    return {"status": "completed", "benchmark": results}


@app.post("/api/proxy/probe")
def probe_upstreams(req: ProxyProbeRequest) -> dict[str, Any]:
    import math
    import time

    probed = []
    for t in req.targets[:8]:
        resolved = _resolve_and_validate_probe_url(t.url)
        if resolved is None:
            raise HTTPException(status_code=400, detail=f"Blocked unsafe or private probe URL: {t.url}")
        parsed_url, pinned_ip, port = resolved
        samples: list[float] = []
        status_code = 0
        errors = 0
        for _ in range(req.requestsPerTarget):
            t0 = time.perf_counter()
            try:
                status_code = _pinned_http_get_no_redirect(parsed_url, pinned_ip, port, timeout=5.0)
                if status_code >= 400:
                    errors += 1
                samples.append((time.perf_counter() - t0) * 1000.0)
            except Exception:
                samples.append(max((time.perf_counter() - t0) * 1000.0, 800.0))
                errors += 1

        samples.sort()
        p50 = samples[len(samples) // 2] if samples else 0.0
        p95 = samples[-1] if samples else 0.0
        err_rate = errors / max(1, req.requestsPerTarget)
        norm_lat = min(1.0, p95 / 600.0)
        est_cpu = min(0.95, 0.15 + norm_lat * 0.65 + err_rate * 0.5)
        a_sc, _ = controller.anfis.forward_single([est_cpu, 0.30, norm_lat, 0.25])
        g_sc = controller.gp.score_nodes(
            [{"CPU": est_cpu, "MEM": 0.30, "LAT": norm_lat, "CONN": 0.25, "ERR": err_rate, "CAP": t.cores}]
        )[0]
        raw_w = ((0.58 * a_sc + 0.42 * g_sc) ** 1.85) * math.sqrt(max(1.0, t.cores) / 2.0)
        probed.append(
            {
                "id": t.id,
                "name": t.name,
                "url": t.url,
                "cores": t.cores,
                "statusCode": status_code,
                "p50LatencyMs": round(p50, 1),
                "p95LatencyMs": round(p95, 1),
                "errorRate": round(err_rate, 3),
                "anfisScore": round(a_sc, 1),
                "gpScore": round(g_sc, 1),
                "rawWeight": 0.01 if errors == req.requestsPerTarget else raw_w,
            }
        )

    tot_w = sum(item["rawWeight"] for item in probed) or 1.0
    for item in probed:
        item["assignedWeightPct"] = max(1, round((item["rawWeight"] / tot_w) * 100))

    return {"status": "ok", "targets": probed}


@app.websocket("/ws/telemetry")
async def websocket_telemetry(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            await ws.send_json(controller.get_full_state())
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        return
    except Exception:
        return
