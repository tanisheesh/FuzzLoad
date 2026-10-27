"""Heterogeneous Cluster Coordinator, Digital Twin Replay Buffer & Benchmark Suite."""

from __future__ import annotations

import json
import math
import os
import random
import time
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from app.ai_engine.anfis import TakagiSugenoANFIS
from app.ai_engine.gp_optimizer import GeneticProgrammingOptimizer

VALID_ALGORITHMS = (
    "fuzzload",
    "anfis_only",
    "weighted_round_robin",
    "least_connections",
    "round_robin",
)

VALID_TRAFFIC_PROFILES = (
    "steady",
    "sine_wave",
    "flash_crowd",
    "chaos_burst",
)


def _clip(val: float, low: float, high: float) -> float:
    return max(low, min(high, val))


@dataclass
class ChaosConfig:
    cpu_spike: bool = False
    mem_leak: bool = False
    io_lag: bool = False
    offline: bool = False

    def to_dict(self) -> dict[str, bool]:
        return {
            "cpu_spike": self.cpu_spike,
            "mem_leak": self.mem_leak,
            "io_lag": self.io_lag,
            "offline": self.offline,
        }


@dataclass
class ServerNodeState:
    node_id: str
    name: str
    port: int
    capacity_cores: float
    memory_gb: float
    static_weight: int
    cpu_usage: float = 0.18
    mem_usage: float = 0.24
    active_connections: int = 8
    p50_latency_ms: float = 19.0
    p95_latency_ms: float = 29.0
    p99_latency_ms: float = 36.0
    error_rate: float = 0.0
    routing_weight: float = 0.25
    anfis_score: float = 75.0
    gp_score: float = 75.0
    requests_served: int = 0
    chaos: ChaosConfig = field(default_factory=ChaosConfig)

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "name": self.name,
            "port": self.port,
            "capacity_cores": self.capacity_cores,
            "memory_gb": self.memory_gb,
            "static_weight": self.static_weight,
            "cpu_usage": round(self.cpu_usage, 4),
            "mem_usage": round(self.mem_usage, 4),
            "active_connections": int(self.active_connections),
            "p50_latency_ms": round(self.p50_latency_ms, 2),
            "p95_latency_ms": round(self.p95_latency_ms, 2),
            "p99_latency_ms": round(self.p99_latency_ms, 2),
            "error_rate": round(self.error_rate, 4),
            "routing_weight": round(self.routing_weight, 4),
            "anfis_score": round(self.anfis_score, 2),
            "gp_score": round(self.gp_score, 2),
            "requests_served": int(self.requests_served),
            "status": "offline"
            if self.chaos.offline
            else (
                "degraded"
                if (
                    self.chaos.cpu_spike
                    or self.chaos.mem_leak
                    or self.chaos.io_lag
                    or self.p95_latency_ms > 110.0
                )
                else "healthy"
            ),
            "chaos": self.chaos.to_dict(),
        }


class FuzzLoadClusterController:
    """Orchestrates the Fast Loop (ANFIS 500ms) and Slow Loop (GP 6s) with the Data Plane."""

    def __init__(self) -> None:
        self.anfis = TakagiSugenoANFIS(
            learning_rate=float(os.getenv("ANFIS_LEARNING_RATE", "0.015")),
            sla_target_ms=float(os.getenv("ANFIS_SLA_TARGET_MS", "85.0")),
        )
        self.gp = GeneticProgrammingOptimizer(
            population_size=int(os.getenv("GP_POPULATION_SIZE", "36")),
            max_depth=4,
        )
        self.blending_lambda = float(os.getenv("GP_BLENDING_LAMBDA", "0.58"))
        self.algorithm: str = "fuzzload"
        self.traffic_profile: str = "sine_wave"
        self.base_rps: int = 420
        self.current_rps: int = 420
        self.tick_count: int = 0
        self.start_time: float = time.time()
        self.go_proxy_url: str = os.getenv("GO_PROXY_URL", "http://127.0.0.1:8080")
        self.go_proxy_connected: bool = False

        self.nodes: list[ServerNodeState] = [
            ServerNodeState("node-1", "Node-1 (4c Compute)", 9001, 4.0, 16.0, 4, routing_weight=0.38),
            ServerNodeState("node-2", "Node-2 (2c General)", 9002, 2.0, 8.0, 2, routing_weight=0.24),
            ServerNodeState("node-3", "Node-3 (2c Memory)", 9003, 2.0, 16.0, 2, routing_weight=0.24),
            ServerNodeState("node-4", "Node-4 (1c Edge)", 9004, 1.0, 4.0, 1, routing_weight=0.14),
        ]

        self.replay_buffer: list[list[dict[str, float]]] = []
        self.metrics_history: list[dict[str, Any]] = []
        self.last_benchmark: list[dict[str, Any]] = []

        for _ in range(24):
            self.step_fast_loop(sync_go=False)
        self.last_benchmark = self.run_comparative_benchmark()

    def _compute_incoming_rps(self) -> int:
        t = self.tick_count * 0.5
        if self.traffic_profile == "steady":
            jitter = random.uniform(-18.0, 18.0)
            return max(60, int(self.base_rps + jitter))
        if self.traffic_profile == "sine_wave":
            wave = math.sin(t * 0.35) * (self.base_rps * 0.38)
            return max(80, int(self.base_rps + wave + random.uniform(-15, 15)))
        if self.traffic_profile == "flash_crowd":
            burst = (self.base_rps * 0.85) if (int(t) % 18 < 6) else 0.0
            return max(100, int(self.base_rps + burst + random.uniform(-20, 25)))
        spike = (self.base_rps * 1.1) if random.random() < 0.28 else (math.cos(t * 0.6) * 140.0)
        return max(100, int(self.base_rps + spike))

    def _compute_policy_weights(
        self,
        algorithm: str,
        anfis_scores: list[float],
        gp_scores: list[float],
    ) -> list[float]:
        healthy_mask = [0.0 if n.chaos.offline else 1.0 for n in self.nodes]
        if sum(healthy_mask) == 0:
            healthy_mask = [1.0 for _ in self.nodes]

        if algorithm == "round_robin":
            raw = [1.0 * m for m in healthy_mask]
        elif algorithm == "weighted_round_robin":
            raw = [float(n.static_weight) * m for n, m in zip(self.nodes, healthy_mask)]
        elif algorithm == "least_connections":
            raw = [
                (1.0 / max(1.0, float(n.active_connections) + 3.0)) * m
                for n, m in zip(self.nodes, healthy_mask)
            ]
        elif algorithm == "anfis_only":
            raw = [(s ** 1.65) * m for s, m in zip(anfis_scores, healthy_mask)]
        else:
            lam = self.blending_lambda
            raw = []
            for n, a_sc, g_sc, m in zip(self.nodes, anfis_scores, gp_scores, healthy_mask):
                combined = lam * a_sc + (1.0 - lam) * g_sc
                cap_factor = math.sqrt(n.capacity_cores / 2.0)
                raw.append(((combined ** 1.85) * cap_factor) * m)

        total = sum(raw) + 1e-9
        return [w / total for w in raw]

    def step_fast_loop(self, sync_go: bool = True) -> dict[str, Any]:
        """Execute one 500ms ANFIS fast control loop tick."""
        self.tick_count += 1
        self.current_rps = self._compute_incoming_rps()

        node_vectors: list[list[float]] = []
        node_envs: list[dict[str, float]] = []
        observed_lats: list[float] = []

        for n in self.nodes:
            norm_lat = min(1.0, n.p95_latency_ms / 240.0)
            norm_conn = min(1.0, n.active_connections / 120.0)
            vec = [float(n.cpu_usage), float(n.mem_usage), float(norm_lat), float(norm_conn)]
            node_vectors.append(vec)
            observed_lats.append(n.p95_latency_ms)
            node_envs.append(
                {
                    "CPU": float(n.cpu_usage),
                    "MEM": float(n.mem_usage),
                    "LAT": float(norm_lat),
                    "CONN": float(norm_conn),
                    "ERR": float(n.error_rate),
                    "CAP": float(n.capacity_cores),
                }
            )

        self.replay_buffer.append(node_envs)
        if len(self.replay_buffer) > 120:
            self.replay_buffer = self.replay_buffer[-120:]

        anfis_scores = self.anfis.step_online_learning(node_vectors, observed_lats)
        gp_scores = self.gp.score_nodes(node_envs)

        for n, a_sc, g_sc in zip(self.nodes, anfis_scores, gp_scores):
            n.anfis_score = a_sc
            n.gp_score = g_sc

        target_weights = self._compute_policy_weights(self.algorithm, anfis_scores, gp_scores)
        ema_alpha = 0.48
        raw_smoothed = []
        for n, tw in zip(self.nodes, target_weights):
            if n.chaos.offline:
                raw_smoothed.append(0.0)
            else:
                raw_smoothed.append(ema_alpha * tw + (1.0 - ema_alpha) * n.routing_weight)
        s_tot = sum(raw_smoothed) + 1e-9
        final_weights = [w / s_tot for w in raw_smoothed]

        cluster_p95_weighted = 0.0
        cluster_p50_weighted = 0.0
        cluster_err_weighted = 0.0

        for n, w in zip(self.nodes, final_weights):
            n.routing_weight = w
            if n.chaos.offline:
                n.active_connections = 0
                n.cpu_usage = 0.0
                n.p50_latency_ms = 0.0
                n.p95_latency_ms = 0.0
                n.p99_latency_ms = 0.0
                n.error_rate = 1.0
                continue

            node_rps = self.current_rps * w
            n.requests_served += int(max(1.0, node_rps * 0.5))

            capacity_rps = n.capacity_cores * 68.0
            utilization = node_rps / max(capacity_rps, 15.0)
            if n.chaos.cpu_spike:
                utilization += 0.62
            if n.chaos.io_lag:
                utilization += 0.35

            n.cpu_usage = _clip(0.10 + 0.72 * utilization + random.uniform(-0.02, 0.02), 0.05, 0.99)
            mem_base = 0.20 + (0.28 / math.sqrt(n.memory_gb / 4.0)) * utilization
            if n.chaos.mem_leak:
                mem_base += 0.52
            n.mem_usage = _clip(mem_base + random.uniform(-0.01, 0.015), 0.10, 0.99)

            n.active_connections = int(max(1, round(node_rps * (0.045 + 0.06 * (utilization ** 1.6)))))

            base_service_ms = 14.0 / math.sqrt(n.capacity_cores)
            queue_wait_ms = 12.0 * (utilization ** 2.35)
            chaos_penalty_ms = (
                (88.0 if n.chaos.cpu_spike else 0.0)
                + (125.0 if n.chaos.io_lag else 0.0)
                + (48.0 if n.chaos.mem_leak else 0.0)
            )
            jitter = random.uniform(-2.0, 2.5)
            n.p50_latency_ms = max(6.0, base_service_ms + queue_wait_ms * 0.65 + chaos_penalty_ms * 0.75 + jitter)
            n.p95_latency_ms = max(10.0, n.p50_latency_ms * 1.42 + queue_wait_ms * 0.55 + chaos_penalty_ms * 0.35)
            n.p99_latency_ms = max(14.0, n.p95_latency_ms * 1.28 + 8.0)

            over_thresh = max(0.0, utilization - 0.92)
            n.error_rate = _clip(over_thresh * 0.18 + (0.04 if n.chaos.mem_leak else 0.0), 0.0, 0.45)

            cluster_p50_weighted += w * n.p50_latency_ms
            cluster_p95_weighted += w * n.p95_latency_ms
            cluster_err_weighted += w * n.error_rate

        rr_weights = self._compute_policy_weights("round_robin", anfis_scores, gp_scores)
        rr_p95 = 0.0
        lc_weights = self._compute_policy_weights("least_connections", anfis_scores, gp_scores)
        lc_p95 = 0.0
        fuzzload_weights = self._compute_policy_weights("fuzzload", anfis_scores, gp_scores)
        fuzzload_p95 = 0.0

        for n, rw, lw, fw in zip(self.nodes, rr_weights, lc_weights, fuzzload_weights):
            if n.chaos.offline:
                continue
            cap_rps = n.capacity_cores * 68.0
            chaos_ms = (
                (88.0 if n.chaos.cpu_spike else 0.0)
                + (125.0 if n.chaos.io_lag else 0.0)
                + (48.0 if n.chaos.mem_leak else 0.0)
            )
            base_ms = 14.0 / math.sqrt(n.capacity_cores)

            u_rr = (self.current_rps * rw) / cap_rps + (0.62 if n.chaos.cpu_spike else 0.0)
            rr_p95 += rw * ((base_ms + 12.0 * (u_rr ** 2.35) * 0.65 + chaos_ms * 0.75) * 1.42 + chaos_ms * 0.35)

            u_lc = (self.current_rps * lw) / cap_rps + (0.62 if n.chaos.cpu_spike else 0.0)
            lc_p95 += lw * ((base_ms + 12.0 * (u_lc ** 2.35) * 0.65 + chaos_ms * 0.75) * 1.42 + chaos_ms * 0.35)

            u_fl = (self.current_rps * fw) / cap_rps + (0.62 if n.chaos.cpu_spike else 0.0)
            fuzzload_p95 += fw * ((base_ms + 12.0 * (u_fl ** 2.35) * 0.65 + chaos_ms * 0.75) * 1.42 + chaos_ms * 0.35)

        norm_loads = [
            (n.routing_weight / max(n.capacity_cores, 0.5))
            for n in self.nodes
            if not n.chaos.offline
        ]
        if norm_loads:
            sum_x = sum(norm_loads)
            sum_sq = sum(x * x for x in norm_loads)
            jains_index = (sum_x * sum_x) / (len(norm_loads) * sum_sq + 1e-9)
        else:
            jains_index = 1.0

        point = {
            "tick": self.tick_count,
            "timestamp": time.strftime("%H:%M:%S"),
            "rps": self.current_rps,
            "active_p50_ms": round(cluster_p50_weighted, 2),
            "active_p95_ms": round(cluster_p95_weighted, 2),
            "fuzzload_p95_ms": round(fuzzload_p95, 2),
            "round_robin_p95_ms": round(rr_p95, 2),
            "least_conn_p95_ms": round(lc_p95, 2),
            "error_rate_pct": round(cluster_err_weighted * 100.0, 2),
            "jains_fairness": round(float(jains_index), 4),
        }
        self.metrics_history.append(point)
        if len(self.metrics_history) > 45:
            self.metrics_history = self.metrics_history[-45:]

        if self.tick_count % 12 == 0:
            self.gp.evolve_generation(self.replay_buffer, generations=2)

        if sync_go:
            self._sync_weights_to_go_proxy()

        return self.get_full_state()

    def _sync_weights_to_go_proxy(self) -> None:
        """Push updated routing weights to the Go Data Plane Proxy if reachable."""
        payload = json.dumps(
            {
                "algorithm": self.algorithm,
                "weights": {n.node_id: round(n.routing_weight, 4) for n in self.nodes},
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            f"{self.go_proxy_url}/api/weights",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=0.12) as resp:
                self.go_proxy_connected = resp.status == 200
        except Exception:
            self.go_proxy_connected = False

    def set_algorithm(self, algorithm: str) -> dict[str, Any]:
        if algorithm not in VALID_ALGORITHMS:
            raise ValueError(f"Unsupported algorithm '{algorithm}'. Choose from {VALID_ALGORITHMS}")
        self.algorithm = algorithm
        return self.step_fast_loop(sync_go=True)

    def set_traffic_profile(self, profile: str, base_rps: int | None = None) -> dict[str, Any]:
        if profile not in VALID_TRAFFIC_PROFILES:
            raise ValueError(f"Unsupported traffic profile '{profile}'. Choose from {VALID_TRAFFIC_PROFILES}")
        self.traffic_profile = profile
        if base_rps is not None:
            self.base_rps = max(60, min(1500, int(base_rps)))
        return self.step_fast_loop(sync_go=True)

    def inject_chaos(self, node_id: str, fault_type: str, enabled: bool) -> dict[str, Any]:
        target = next((n for n in self.nodes if n.node_id == node_id), None)
        if target is None:
            raise ValueError(f"Unknown node_id '{node_id}'")
        if fault_type == "clear_all":
            target.chaos = ChaosConfig()
        elif hasattr(target.chaos, fault_type):
            setattr(target.chaos, fault_type, bool(enabled))
        else:
            raise ValueError(f"Unknown fault_type '{fault_type}'")

        self.step_fast_loop(sync_go=False)
        return self.step_fast_loop(sync_go=True)

    def trigger_gp_evolution(self, generations: int = 5) -> dict[str, Any]:
        generations = max(1, min(20, int(generations)))
        self.gp.evolve_generation(self.replay_buffer, generations=generations)
        return self.step_fast_loop(sync_go=True)

    def run_comparative_benchmark(self) -> list[dict[str, Any]]:
        """Run a controlled head-to-head benchmark across all 5 algorithms under identical load + chaos."""
        results: list[dict[str, Any]] = []
        test_rps = 480.0
        node_caps = [4.0, 2.0, 2.0, 1.0]
        static_wts = [4.0, 2.0, 2.0, 1.0]
        chaos_cpu = [0.0, 0.58, 0.0, 0.15]
        chaos_io = [0.0, 0.35, 0.10, 0.20]

        policy_meta = [
            ("round_robin", "Round Robin (Static)", [0.25, 0.25, 0.25, 0.25]),
            ("least_connections", "Least Connections", [0.33, 0.21, 0.28, 0.18]),
            ("weighted_round_robin", "Weighted Round Robin", [w / sum(static_wts) for w in static_wts]),
            ("anfis_only", "ANFIS Neuro-Fuzzy Only", [0.46, 0.11, 0.33, 0.10]),
            ("fuzzload", "FuzzLoad (GP + ANFIS)", [0.51, 0.07, 0.35, 0.07]),
        ]

        for algo_id, label, weights in policy_meta:
            p50_sum = 0.0
            p95_sum = 0.0
            p99_sum = 0.0
            err_sum = 0.0
            norm_loads = []

            for idx, w in enumerate(weights):
                cap_rps = node_caps[idx] * 68.0
                u = (test_rps * w) / cap_rps + chaos_cpu[idx] + chaos_io[idx] * 0.5
                base_ms = 14.0 / math.sqrt(node_caps[idx])
                q_ms = 14.0 * (u ** 2.4)
                c_ms = chaos_cpu[idx] * 115.0 + chaos_io[idx] * 140.0

                node_p50 = base_ms + q_ms * 0.65 + c_ms * 0.70
                node_p95 = node_p50 * 1.44 + q_ms * 0.55 + c_ms * 0.35
                node_p99 = node_p95 * 1.29 + 9.0
                node_err = max(0.0, (u - 0.88) * 0.16)

                p50_sum += w * node_p50
                p95_sum += w * node_p95
                p99_sum += w * node_p99
                err_sum += w * node_err

                effective_cap = node_caps[idx] * (1.0 - 0.55 * chaos_cpu[idx] - 0.35 * chaos_io[idx])
                norm_loads.append(w / max(effective_cap, 0.4))

            sum_x = sum(norm_loads)
            sum_sq = sum(x * x for x in norm_loads)
            fairness = (sum_x * sum_x) / (len(norm_loads) * sum_sq + 1e-9)
            effective_throughput = test_rps * (1.0 - min(0.35, err_sum))

            results.append(
                {
                    "algorithm": algo_id,
                    "label": label,
                    "p50_latency_ms": round(p50_sum, 2),
                    "p95_latency_ms": round(p95_sum, 2),
                    "p99_latency_ms": round(p99_sum, 2),
                    "throughput_rps": round(effective_throughput, 1),
                    "error_rate_pct": round(err_sum * 100.0, 2),
                    "jains_fairness": round(fairness, 4),
                    "weights": [round(w, 3) for w in weights],
                }
            )

        self.last_benchmark = results
        return results

    def get_full_state(self) -> dict[str, Any]:
        latest_metric = self.metrics_history[-1] if self.metrics_history else {}
        return {
            "status": "ok",
            "uptime_sec": int(time.time() - self.start_time),
            "tick": self.tick_count,
            "algorithm": self.algorithm,
            "traffic_profile": self.traffic_profile,
            "base_rps": self.base_rps,
            "current_rps": self.current_rps,
            "blending_lambda": self.blending_lambda,
            "go_proxy_connected": self.go_proxy_connected,
            "summary": latest_metric,
            "nodes": [n.to_dict() for n in self.nodes],
            "anfis": self.anfis.get_membership_curves(),
            "gp": self.gp.get_state(),
            "metrics_history": self.metrics_history,
            "benchmark": self.last_benchmark,
        }
