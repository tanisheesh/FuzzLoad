// Package fuzzload provides a zero-allocation, lock-free L7 HTTP reverse proxy
// and adaptive load-balancing router powered by Neuro-Fuzzy inference and
// Genetic Programming heuristics.
//
// # Architecture
//
// On the HTTP hot path, [Proxy.SelectUpstream] reads an immutable Copy-on-Write
// routing snapshot via [sync/atomic.Pointer] with zero mutex locks and zero heap
// allocations (~7.5 ns/op, 0 B/op, 0 allocs/op). Per-node latency observations
// are recorded into a fixed-size atomic ring buffer ([LatencyRing]), deferring
// P50/P95/P99 sorting until telemetry scrape.
//
// # Standalone Pure-Go Mode vs. Python Control-Plane Mode
//
// FuzzLoad can operate in two modes:
//   - Standalone Pure-Go: call [Proxy.StartAutoControlLoop] to run the built-in
//     Gaussian Neuro-Fuzzy + symbolic GP weight optimizer directly inside Go.
//   - Coupled Python ANFIS+GP Control Plane: mount [Proxy.ControlMux] so the
//     external Python FastAPI engine pulls GET /api/telemetry and pushes evolved
//     weights via POST /api/weights every 500ms.
//
// # Installation
//
//	go get github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload@v1.0.0
package fuzzload
