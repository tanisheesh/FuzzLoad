# FuzzLoad — Master Completion Goal & Checklist (`GOAL.md`)

**Objective:** Complete all remaining Systems, SDK, CLI, Bidirectional Control-Plane, CI/CD, and Benchmark components to make **FuzzLoad** a 100% genuine, production-grade Go + Python + Next.js flagship project on `main`.

---

## Phase 1: Zero-Allocation Lock-Free Go SDK (`proxy-go/pkg/fuzzload`)
- [x] **`proxy-go/pkg/fuzzload/router.go`** — Copy-on-Write (`atomic.Pointer[routingTable]`) routing table with prefix-sum CDF lookup (`0 allocs/op`, lock-free hot path) and reusable `http.Handler` reverse-proxy middleware (`fuzzload.NewProxy(Config)`).
- [x] **`proxy-go/pkg/fuzzload/telemetry.go`** — Lock-free atomic ring buffer (`[128]uint64` microseconds) for per-node latency tracking (`P50`, `P95`, `P99` computed on scrape, never blocking request threads) + Prometheus `/metrics` handler.
- [x] **`proxy-go/pkg/fuzzload/health.go`** — Passive circuit breaker (trips on consecutive 5xx/timeouts) + active background `/healthz` recovery prober.
- [x] **`proxy-go/pkg/fuzzload/worker.go`** — Configurable heterogeneous worker server (`CapacityCores`, `MemoryGB`, and synthetic chaos states `CPUSpike`, `MemLeak`, `IOLag`, `Offline`).
- [x] **`proxy-go/pkg/fuzzload/router_test.go`** — Unit tests, concurrent race tests (`go test -race ./...`), and microbenchmarks (`go test -bench=. -benchmem`).

---

## Phase 2: Configurable Go Data-Plane Binary (`proxy-go/cmd/fuzzload-proxy/main.go`)
- [x] Support CLI flags: `--port`, `--upstreams`, `--weights`, `--policy`, `--config`, `--spawn-workers`, and `--loadgen-rps`.
- [x] Expose control & observability endpoints: `GET /api/telemetry`, `POST /api/weights`, `POST /api/chaos`, `POST /api/loadgen`, `GET /metrics`, and `GET /healthz`.
- [x] Built-in background HTTP load generator (`/api/loadgen`) to drive real socket traffic across worker nodes when running locally or in Docker.

---

## Phase 3: Bidirectional Go <-> Python AI Control Plane (`backend/app/cluster/simulator.py`)
- [x] **Pull Real Telemetry (`GET /api/telemetry`):** When `go_proxy_connected` is `True`, ingest real Go worker `P50/P95/P99` latency, `active_connections`, `requests_served`, `cpu_usage`, `mem_usage`, and `error_rate` into the 500ms ANFIS fast loop and 60s GP replay buffer.
- [x] **Push Evolved Weights (`POST /api/weights`):** Publish ANFIS + GP + Exponential BAM weights back into Go's lock-free atomic routing table every 500ms.
- [x] **Forward Chaos Faults (`POST /api/chaos`):** Synchronize node fault injections (`cpu_spike`, `mem_leak`, `io_lag`, `offline`, `clear_all`) from the Python Control Plane directly into the Go worker nodes.
- [x] **Seamless Fallback:** Maintain zero-error fallback to the internal Python Digital Twin queueing simulator when the Go proxy is not running.

---

## Phase 4: Python SDK (`fuzzload`) & Multi-Command CLI (`backend/app/cli.py`)
- [x] Create `backend/fuzzload/__init__.py` and update `backend/pyproject.toml` so both `from fuzzload import FuzzLoadRouter` and `from app.cli import FuzzLoadRouter` work cleanly.
- [x] Wire `fuzzload start --upstreams ... --weights ... --policy ... --config ... --port ...` flags into the running FastAPI control plane.
- [x] Add `fuzzload probe --urls ... --requests 5` to probe live HTTP endpoints from the terminal and print an ASCII table of P50/P95 latencies, ANFIS scores, GP scores, and routing weights.
- [x] Add `fuzzload bench` to run the 5-algorithm benchmark suite from the terminal (Markdown or JSON).

---

## Phase 5: Frontend SDK & Data-Plane Integration (`frontend/`)
- [x] Add **`GO SDK`** tab on `/` (`frontend/src/app/page.tsx`) and `/playground` (`frontend/src/app/playground/page.tsx`) generating ready-to-copy Go code using `github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload`.
- [x] Add live Data-Plane status badge on `/dashboard` (`frontend/src/app/dashboard/page.tsx`) indicating whether telemetry is streaming from the live Go proxy (`:8080`) or the Digital Twin engine.

---

## Phase 6: Dockerfiles, GitHub Actions CI & Benchmark Documentation
- [x] Fix invalid Dependabot image tags in root `Dockerfile` (`golang:1.23-alpine` and `python:3.12-slim`) and include `proxy-go/pkg/` and `backend/fuzzload/` in multi-stage builds.
- [x] Update `.github/workflows/ci.yml` to run Go (`go vet ./...`, `go test -v -race ./...`, `go test -bench=. -benchmem`, `go build`), Python (`pytest`), and Frontend (`pnpm run typecheck && pnpm run build`).
- [x] Update `bench/run_benchmark.py` and `bench/README.md` with `--live-go` HTTP socket benchmark mode and Go SDK microbenchmark instructions.

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
