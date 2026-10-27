"""Unit and Integration Tests for FuzzLoad AI Control Plane (ANFIS + GP + Cluster)."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ai_engine.anfis import TakagiSugenoANFIS
from app.ai_engine.gp_optimizer import GeneticProgrammingOptimizer, protected_div
from app.cli import FuzzLoadRouter
from app.cluster.simulator import FuzzLoadClusterController


def test_anfis_five_layer_forward_and_backprop() -> None:
    anfis = TakagiSugenoANFIS(learning_rate=0.02, sla_target_ms=80.0)
    healthy_vec = [0.15, 0.22, 0.14, 0.12]
    stressed_vec = [0.92, 0.88, 0.89, 0.85]

    healthy_score, cache_h = anfis.forward_single(healthy_vec)
    stressed_score, cache_s = anfis.forward_single(stressed_vec)

    assert 1.0 <= healthy_score <= 100.0
    assert 1.0 <= stressed_score <= 100.0
    assert healthy_score > stressed_score + 20.0
    assert abs(sum(cache_h["w_norm"]) - 1.0) < 1e-4
    assert abs(sum(cache_s["w_norm"]) - 1.0) < 1e-4

    initial_epoch = anfis.epoch
    scores = anfis.step_online_learning([healthy_vec, stressed_vec], [22.0, 195.0])
    assert len(scores) == 2
    assert anfis.epoch == initial_epoch + 1

    curves = anfis.get_membership_curves()
    assert "cpu" in curves["curves"]
    assert len(curves["rules"]) == 12


def test_genetic_programming_symbolic_evolution() -> None:
    gp = GeneticProgrammingOptimizer(population_size=20, max_depth=4)
    initial_gen = gp.generation

    env_healthy = {"CPU": 0.15, "MEM": 0.20, "LAT": 0.12, "CONN": 0.10, "ERR": 0.0, "CAP": 4.0}
    env_degraded = {"CPU": 0.90, "MEM": 0.85, "LAT": 0.88, "CONN": 0.82, "ERR": 0.05, "CAP": 1.0}

    scores = gp.score_nodes([env_healthy, env_degraded])
    assert len(scores) == 2
    assert scores[0] > scores[1]

    state = gp.evolve_generation([[env_healthy, env_degraded]], generations=3)
    assert state["generation"] == initial_gen + 3
    assert state["best_fitness"] > 0.0
    assert isinstance(state["best_formula"], str)
    assert "children" in state["ast_tree"]
    assert protected_div(10.0, 0.0) > 0.0


def test_cluster_controller_chaos_and_algorithms() -> None:
    ctrl = FuzzLoadClusterController()
    state = ctrl.get_full_state()
    assert state["algorithm"] == "fuzzload"
    assert len(state["nodes"]) == 4

    updated = ctrl.inject_chaos("node-2", "cpu_spike", True)
    updated = ctrl.inject_chaos("node-2", "io_lag", True)
    nodes_by_id = {n["node_id"]: n for n in updated["nodes"]}
    assert nodes_by_id["node-1"]["routing_weight"] > nodes_by_id["node-2"]["routing_weight"]

    offline_state = ctrl.inject_chaos("node-4", "offline", True)
    node4 = next(n for n in offline_state["nodes"] if n["node_id"] == "node-4")
    assert node4["routing_weight"] == 0.0
    assert node4["status"] == "offline"

    ctrl.inject_chaos("node-2", "clear_all", True)
    ctrl.inject_chaos("node-4", "clear_all", True)
    bench = ctrl.run_comparative_benchmark()
    assert len(bench) == 5
    by_algo = {b["algorithm"]: b for b in bench}
    assert by_algo["fuzzload"]["p95_latency_ms"] < by_algo["round_robin"]["p95_latency_ms"]


def test_fuzzload_router_sdk() -> None:
    router = FuzzLoadRouter(
        upstreams=[
            {"id": "fast-node", "url": "http://127.0.0.1:4001", "cores": 4.0},
            {"id": "slow-node", "url": "http://127.0.0.1:4002", "cores": 1.0},
        ]
    )
    weights = router.record_telemetry("slow-node", latency_ms=210.0, cpu=0.92, mem=0.88)
    router.record_telemetry("fast-node", latency_ms=16.0, cpu=0.18, mem=0.22)
    weights = router.record_telemetry("slow-node", latency_ms=225.0, cpu=0.95, mem=0.90)
    assert weights["fast-node"] > weights["slow-node"]
    chosen = router.select_upstream()
    assert chosen in ("http://127.0.0.1:4001", "http://127.0.0.1:4002")


class FuzzLoadTestSuite(unittest.TestCase):
    def test_all(self) -> None:
        test_anfis_five_layer_forward_and_backprop()
        test_genetic_programming_symbolic_evolution()
        test_cluster_controller_chaos_and_algorithms()
        test_fuzzload_router_sdk()


if __name__ == "__main__":
    unittest.main()
