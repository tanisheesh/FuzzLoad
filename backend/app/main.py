"""FastAPI Entrypoint for FuzzLoad AI Control Plane & Telemetry Streamer."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.cluster.simulator import FuzzLoadClusterController

controller = FuzzLoadClusterController()
_bg_task: asyncio.Task[None] | None = None


async def _control_plane_loop() -> None:
    """Background coroutine executing the 500ms ANFIS Fast Loop & 6s GP Slow Loop."""
    while True:
        try:
            controller.step_fast_loop(sync_go=True)
        except Exception:
            pass
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
