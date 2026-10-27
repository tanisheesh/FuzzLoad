"""Reproducible Benchmark Suite for FuzzLoad vs Classical Load-Balancing Policies.

Executes a controlled multi-algorithm evaluation across heterogeneous worker nodes
under burst + chaos conditions and prints Markdown & IEEE LaTeX tables.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.cluster.simulator import FuzzLoadClusterController


def main() -> None:
    ctrl = FuzzLoadClusterController()
    results = ctrl.run_comparative_benchmark()

    print("# FuzzLoad — Verified Comparative Benchmark Results\n")
    print("| Algorithm | P50 (ms) | P95 Tail (ms) | P99 (ms) | Throughput (RPS) | Error Rate (%) | Jain's Fairness |")
    print("|---|---:|---:|---:|---:|---:|---:|")
    for r in results:
        print(
            f"| **{r['label']}** | {r['p50_latency_ms']} | {r['p95_latency_ms']} | "
            f"{r['p99_latency_ms']} | {r['throughput_rps']} | {r['error_rate_pct']}% | {r['jains_fairness']} |"
        )


if __name__ == "__main__":
    main()
