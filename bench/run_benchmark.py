"""Reproducible Benchmark Suite for FuzzLoad vs Classical Load-Balancing Policies.

Supports two modes:
  1. Default (Digital Twin): Executes a controlled 5-policy comparative evaluation
     across heterogeneous worker nodes under burst + chaos conditions.
  2. Live Go Proxy (--live-go): Fires concurrent HTTP requests directly against a
     running FuzzLoad Go Reverse Proxy (:8080) across each routing policy and measures
     true socket P50 / P95 / P99 latencies and throughput.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.cluster.simulator import FuzzLoadClusterController


def _percentile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    pos = q * (len(sorted_vals) - 1)
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return sorted_vals[lo]
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (pos - lo)


def run_live_go_benchmark(proxy_url: str, total_requests: int, concurrency: int) -> None:
    policies = [
        ("round_robin", "Round Robin (Static)", {"node-1": 0.25, "node-2": 0.25, "node-3": 0.25, "node-4": 0.25}),
        ("least_connections", "Least Connections", {"node-1": 0.25, "node-2": 0.25, "node-3": 0.25, "node-4": 0.25}),
        ("weighted_round_robin", "Weighted Round Robin", {"node-1": 0.44, "node-2": 0.22, "node-3": 0.22, "node-4": 0.12}),
        ("anfis_only", "ANFIS Neuro-Fuzzy Only", {"node-1": 0.46, "node-2": 0.11, "node-3": 0.33, "node-4": 0.10}),
        ("fuzzload", "FuzzLoad (GP + ANFIS)", {"node-1": 0.51, "node-2": 0.07, "node-3": 0.35, "node-4": 0.07}),
    ]

    print(f"# FuzzLoad — Live Go Data-Plane Benchmark ({total_requests} reqs @ concurrency={concurrency})\n")
    print("| Algorithm | P50 (ms) | P95 Tail (ms) | P99 (ms) | Throughput (RPS) | Error Rate (%) |")
    print("|---|---:|---:|---:|---:|---:|")

    for algo_id, label, weights in policies:
        payload = json.dumps({"algorithm": algo_id, "weights": weights}).encode("utf-8")
        req = urllib.request.Request(
            f"{proxy_url.rstrip('/')}/api/weights",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            _ = resp.read()

        latencies: list[float] = []
        errors = 0

        def _hit(_: int) -> tuple[float, bool]:
            t0 = time.perf_counter()
            try:
                with urllib.request.urlopen(f"{proxy_url.rstrip('/')}/work", timeout=5.0) as r:
                    _ = r.read()
                    return (time.perf_counter() - t0) * 1000.0, r.status >= 500
            except Exception:
                return (time.perf_counter() - t0) * 1000.0, True

        wall_start = time.perf_counter()
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
            for ms, is_err in pool.map(_hit, range(total_requests)):
                latencies.append(ms)
                if is_err:
                    errors += 1
        wall_sec = max(0.001, time.perf_counter() - wall_start)
        latencies.sort()

        p50 = round(_percentile(latencies, 0.50), 2)
        p95 = round(_percentile(latencies, 0.95), 2)
        p99 = round(_percentile(latencies, 0.99), 2)
        rps = round(total_requests / wall_sec, 1)
        err_pct = round((errors / max(1, total_requests)) * 100.0, 2)
        print(f"| **{label}** | {p50} | {p95} | {p99} | {rps} | {err_pct}% |")


def run_digital_twin_benchmark() -> None:
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


def main() -> None:
    parser = argparse.ArgumentParser(description="FuzzLoad Comparative Benchmark Runner")
    parser.add_argument("--live-go", action="store_true", help="Benchmark a running Go proxy over real HTTP sockets")
    parser.add_argument("--proxy-url", type=str, default="http://127.0.0.1:8080", help="Running Go proxy base URL")
    parser.add_argument("--requests", type=int, default=400, help="Total HTTP requests per policy in --live-go mode")
    parser.add_argument("--concurrency", type=int, default=24, help="Concurrent HTTP workers in --live-go mode")
    args = parser.parse_args()

    if args.live_go:
        run_live_go_benchmark(args.proxy_url, args.requests, args.concurrency)
    else:
        run_digital_twin_benchmark()


if __name__ == "__main__":
    main()
