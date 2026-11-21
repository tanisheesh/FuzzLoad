"""FuzzLoad Installable Python SDK (`FuzzLoadRouter`) & Gateway CLI (`fuzzload`).

Allows any external Python / FastAPI / microservice project to route traffic
using the 5-Layer Takagi-Sugeno ANFIS + Genetic Programming engine.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import time
import urllib.request
from dataclasses import dataclass
from typing import Any

from app.ai_engine.anfis import TakagiSugenoANFIS
from app.ai_engine.gp_optimizer import GeneticProgrammingOptimizer


@dataclass
class UpstreamTarget:
    id: str
    url: str
    cores: float = 2.0
    cpu: float = 0.20
    mem: float = 0.25
    latency_ms: float = 22.0
    active_conns: int = 4
    error_rate: float = 0.0
    weight: float = 0.25


class FuzzLoadRouter:
    """Drop-in adaptive load-balancing SDK powered by 5-Layer ANFIS + Genetic Programming."""

    def __init__(
        self,
        upstreams: list[dict[str, Any]],
        blending_lambda: float = 0.58,
        sla_target_ms: float = 85.0,
    ) -> None:
        if not upstreams:
            raise ValueError("At least one upstream server must be provided")

        self.anfis = TakagiSugenoANFIS(learning_rate=0.015, sla_target_ms=sla_target_ms)
        self.gp = GeneticProgrammingOptimizer(population_size=28, max_depth=4)
        self.blending_lambda = blending_lambda
        self.targets: list[UpstreamTarget] = []

        init_w = 1.0 / len(upstreams)
        for idx, item in enumerate(upstreams):
            self.targets.append(
                UpstreamTarget(
                    id=str(item.get("id", f"node-{idx+1}")),
                    url=str(item["url"]),
                    cores=float(item.get("cores", 2.0)),
                    weight=float(item.get("weight", init_w)),
                )
            )
        self._recompute_weights()

    def _recompute_weights(self) -> None:
        vectors = []
        envs = []
        lats = []
        for t in self.targets:
            norm_lat = min(1.0, t.latency_ms / 240.0)
            norm_conn = min(1.0, t.active_conns / 120.0)
            vectors.append([t.cpu, t.mem, norm_lat, norm_conn])
            lats.append(t.latency_ms)
            envs.append(
                {
                    "CPU": t.cpu,
                    "MEM": t.mem,
                    "LAT": norm_lat,
                    "CONN": norm_conn,
                    "ERR": t.error_rate,
                    "CAP": t.cores,
                }
            )

        anfis_scores = self.anfis.step_online_learning(vectors, lats)
        gp_scores = self.gp.score_nodes(envs)

        raw_weights = []
        for t, a_sc, g_sc in zip(self.targets, anfis_scores, gp_scores):
            combined = self.blending_lambda * a_sc + (1.0 - self.blending_lambda) * g_sc
            w = (combined ** 1.8) * math.sqrt(max(0.5, t.cores) / 2.0)
            raw_weights.append(w)

        total = sum(raw_weights) + 1e-9
        for t, rw in zip(self.targets, raw_weights):
            t.weight = 0.50 * (rw / total) + 0.50 * t.weight

        norm_total = sum(t.weight for t in self.targets) + 1e-9
        for t in self.targets:
            t.weight = round(t.weight / norm_total, 4)

    def select_upstream(self) -> str:
        """Select an upstream URL in <0.1ms using current ANFIS+GP routing probabilities."""
        total = sum(t.weight for t in self.targets)
        r = random.random() * total
        acc = 0.0
        for t in self.targets:
            acc += t.weight
            if r <= acc:
                return t.url
        return self.targets[-1].url

    def get_weights(self) -> dict[str, float]:
        """Return the current routing probability table keyed by upstream ID."""
        return {t.id: t.weight for t in self.targets}

    def record_telemetry(
        self,
        upstream_id: str,
        latency_ms: float,
        cpu: float | None = None,
        mem: float | None = None,
        active_conns: int | None = None,
        error_rate: float = 0.0,
    ) -> dict[str, float]:
        """Update telemetry for an upstream node and run an online ANFIS adaptation step."""
        for t in self.targets:
            if t.id == upstream_id or t.url == upstream_id:
                t.latency_ms = float(latency_ms)
                if cpu is not None:
                    t.cpu = float(cpu)
                if mem is not None:
                    t.mem = float(mem)
                if active_conns is not None:
                    t.active_conns = int(active_conns)
                t.error_rate = float(error_rate)
                break
        self._recompute_weights()
        return self.get_weights()

    def forward_request(
        self,
        path: str = "/",
        method: str = "GET",
        timeout_sec: float = 5.0,
    ) -> dict[str, Any]:
        """Select an upstream, send an HTTP request, measure real latency, and auto-adapt ANFIS weights."""
        target_url = self.select_upstream()
        target = next(t for t in self.targets if t.url == target_url)
        full_url = target_url.rstrip("/") + "/" + path.lstrip("/")
        t0 = time.perf_counter()
        status_code = 0
        body_bytes = 0
        error_rate = 0.0

        try:
            req = urllib.request.Request(
                full_url,
                headers={"User-Agent": "FuzzLoad-SDK/1.0"},
                method=method.upper(),
            )
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                data = resp.read(8192)
                status_code = resp.status
                body_bytes = len(data)
        except Exception:
            status_code = 502
            error_rate = 1.0

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        est_cpu = min(0.95, 0.15 + min(1.0, elapsed_ms / 500.0) * 0.65 + error_rate * 0.4)
        weights = self.record_telemetry(
            target.id,
            latency_ms=elapsed_ms,
            cpu=est_cpu,
            error_rate=error_rate,
        )
        return {
            "upstream_id": target.id,
            "url": full_url,
            "status_code": status_code,
            "latency_ms": round(elapsed_ms, 2),
            "bytes": body_bytes,
            "weights": weights,
        }


def _cmd_start(args: argparse.Namespace) -> None:
    import uvicorn

    upstreams_str = args.upstreams
    weights_str = args.weights
    policy = args.policy

    if args.config:
        with open(args.config, "r", encoding="utf-8") as fh:
            cfg = json.load(fh)
        if cfg.get("policy"):
            policy = str(cfg["policy"])
        if cfg.get("upstreams"):
            upstreams_str = ",".join(str(u["url"]) for u in cfg["upstreams"])
            weights_str = ",".join(str(u.get("weight", 0.25)) for u in cfg["upstreams"])

    if upstreams_str:
        os.environ["FUZZLOAD_UPSTREAMS"] = upstreams_str
    if weights_str:
        os.environ["FUZZLOAD_WEIGHTS"] = weights_str
    if policy:
        os.environ["FUZZLOAD_POLICY"] = policy
    if args.go_proxy_url:
        os.environ["GO_PROXY_URL"] = args.go_proxy_url

    print(f"[FuzzLoad] Starting AI Control Plane on 0.0.0.0:{args.port} (policy={policy})")
    if upstreams_str:
        print(f"[FuzzLoad] Upstreams: {upstreams_str}")
    print(f"[FuzzLoad] Go Data Plane URL: {os.environ.get('GO_PROXY_URL', 'http://127.0.0.1:8080')}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=args.port, reload=False)


def _cmd_probe(args: argparse.Namespace) -> None:
    urls = [u.strip() for u in args.urls.split(",") if u.strip()]
    if not urls:
        raise SystemExit("Error: pass at least one URL via --urls")

    anfis = TakagiSugenoANFIS(learning_rate=0.015, sla_target_ms=85.0)
    gp = GeneticProgrammingOptimizer(population_size=28, max_depth=4)

    rows = []
    for idx, url in enumerate(urls):
        samples: list[float] = []
        status = 0
        errors = 0
        for _ in range(args.requests):
            t0 = time.perf_counter()
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "FuzzLoad-CLI/1.0"})
                with urllib.request.urlopen(req, timeout=args.timeout) as resp:
                    _ = resp.read(4096)
                    status = resp.status
                samples.append((time.perf_counter() - t0) * 1000.0)
            except Exception:
                samples.append(max((time.perf_counter() - t0) * 1000.0, 800.0))
                errors += 1

        samples.sort()
        p50 = samples[len(samples) // 2]
        p95 = samples[-1]
        err_rate = errors / max(1, args.requests)
        norm_lat = min(1.0, p95 / 600.0)
        est_cpu = min(0.95, 0.15 + norm_lat * 0.65 + err_rate * 0.5)
        a_sc, _ = anfis.forward_single([est_cpu, 0.30, norm_lat, 0.25])
        g_sc = gp.score_nodes(
            [{"CPU": est_cpu, "MEM": 0.30, "LAT": norm_lat, "CONN": 0.25, "ERR": err_rate, "CAP": 2.0}]
        )[0]
        raw_w = 0.01 if errors == args.requests else ((0.58 * a_sc + 0.42 * g_sc) ** 1.85)
        rows.append(
            {
                "id": f"node-{idx+1}",
                "url": url,
                "status": status,
                "p50": round(p50, 1),
                "p95": round(p95, 1),
                "anfis": round(a_sc, 1),
                "gp": round(g_sc, 1),
                "raw_w": raw_w,
            }
        )

    tot_w = sum(r["raw_w"] for r in rows) or 1.0
    print("\nFuzzLoad Live HTTP Probe Report (ANFIS + GP Weight Computation)\n")
    print(f"{'Node':<8} {'Status':<8} {'P50(ms)':>9} {'P95(ms)':>9} {'ANFIS':>8} {'GP':>8} {'Share':>8}  URL")
    print("-" * 88)
    for r in rows:
        share = round((r["raw_w"] / tot_w) * 100.0, 1)
        print(
            f"{r['id']:<8} {r['status']:<8} {r['p50']:>9.1f} {r['p95']:>9.1f} "
            f"{r['anfis']:>8.1f} {r['gp']:>8.1f} {share:>7.1f}%  {r['url']}"
        )


def _cmd_bench(args: argparse.Namespace) -> None:
    from app.cluster.simulator import FuzzLoadClusterController

    ctrl = FuzzLoadClusterController()
    results = ctrl.run_comparative_benchmark()

    if args.format == "json":
        print(json.dumps(results, indent=2))
        return

    print("\n# FuzzLoad — Comparative Benchmark Results (5 Routing Policies)\n")
    print("| Algorithm | P50 (ms) | P95 Tail (ms) | P99 (ms) | Throughput (RPS) | Error Rate (%) | Jain's Fairness |")
    print("|---|---:|---:|---:|---:|---:|---:|")
    for r in results:
        print(
            f"| **{r['label']}** | {r['p50_latency_ms']} | {r['p95_latency_ms']} | "
            f"{r['p99_latency_ms']} | {r['throughput_rps']} | {r['error_rate_pct']}% | {r['jains_fairness']} |"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="fuzzload",
        description="FuzzLoad Adaptive Load Balancer CLI & SDK (5-Layer ANFIS + Genetic Programming)",
    )
    sub = parser.add_subparsers(dest="command")

    start_p = sub.add_parser("start", help="Start the FuzzLoad AI Control Plane & Gateway")
    start_p.add_argument("--upstreams", type=str, default="", help="Comma-separated upstream URLs")
    start_p.add_argument("--weights", type=str, default="", help="Comma-separated initial weights")
    start_p.add_argument("--policy", type=str, default="fuzzload", help="Routing algorithm")
    start_p.add_argument("--config", type=str, default="", help="Path to fuzzload.config.json")
    start_p.add_argument("--go-proxy-url", type=str, default="", help="URL of running Go proxy (default http://127.0.0.1:8080)")
    start_p.add_argument("--port", type=int, default=8000, help="FastAPI control-plane port")

    probe_p = sub.add_parser("probe", help="Probe live HTTP endpoints and compute ANFIS + GP weights")
    probe_p.add_argument("--urls", type=str, required=True, help="Comma-separated HTTP/HTTPS URLs to probe")
    probe_p.add_argument("--requests", type=int, default=3, help="Requests per target URL")
    probe_p.add_argument("--timeout", type=float, default=5.0, help="Per-request timeout in seconds")

    bench_p = sub.add_parser("bench", help="Run the 5-algorithm comparative load-balancing benchmark")
    bench_p.add_argument("--format", choices=["markdown", "json"], default="markdown")

    args = parser.parse_args()
    if args.command == "start":
        _cmd_start(args)
    elif args.command == "probe":
        _cmd_probe(args)
    elif args.command == "bench":
        _cmd_bench(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
