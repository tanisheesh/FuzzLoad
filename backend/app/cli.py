"""FuzzLoad Installable Python SDK (`FuzzLoadRouter`) & Gateway CLI (`fuzzload`).

Allows any external Python / FastAPI / microservice project to route traffic
using the 5-Layer Takagi-Sugeno ANFIS + Genetic Programming engine.
"""

from __future__ import annotations

import argparse
import math
import random
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
                    weight=init_w,
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
        return {t.id: t.weight for t in self.targets}


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="fuzzload",
        description="FuzzLoad Adaptive Load Balancer (5-Layer ANFIS + Genetic Programming)",
    )
    sub = parser.add_subparsers(dest="command")

    start_p = sub.add_parser("start", help="Start the FuzzLoad Control Plane & Gateway")
    start_p.add_argument("--upstreams", type=str, default="http://127.0.0.1:9001,http://127.0.0.1:9002")
    start_p.add_argument("--policy", type=str, default="fuzzload")
    start_p.add_argument("--port", type=int, default=8000)

    args = parser.parse_args()
    if args.command == "start":
        import uvicorn

        print(f"[FuzzLoad] Starting AI Control Plane on port {args.port} (policy={args.policy})")
        print(f"[FuzzLoad] Upstreams: {args.upstreams}")
        uvicorn.run("app.main:app", host="0.0.0.0", port=args.port, reload=False)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
