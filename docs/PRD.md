# FuzzLoad — Product Requirements Document

| Field | Value |
|---|---|
| **Status** | Live |
| **Owner** | Tanish Poddar |
| **Live URL** | [https://fuzzload.tanisheesh.in](https://fuzzload.tanisheesh.in) |
| **Go SDK** | [pkg.go.dev/github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload](https://pkg.go.dev/github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload) |
| **One-liner** | Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control. |

---

## 1. Problem & Quantified Impact

Static reverse-proxy load balancers (Nginx, HAProxy, AWS ALB) route HTTP traffic using fixed heuristics such as Round Robin, Least Connections, or static Weighted Round Robin. In heterogeneous microservice clusters experiencing noisy-neighbor CPU contention, memory leaks, or non-linear I/O stalls (low CPU with high queue wait), static schedulers continue routing full request shares into degraded nodes, driving severe P95/P99 tail-latency cascades and 5xx timeouts.

| Dimension | Before (Static Round Robin Baseline) | After (Target — FuzzLoad GP + ANFIS) |
|---|---|---|
| Cluster P95 Tail Latency (480 RPS + Node-2 Chaos) | `112.4 ms` (`4.15%` error rate) | `34.2 ms` (`0.04%` error rate, **-69.5%**) |
| Capacity-Normalized Jain's Fairness | `0.712` | `0.974` |
| Data-Plane Target Selection Overhead | Lock-based table lookup / manual reload | `4.8–7.5 ns/op`, `0 B/op`, `0 allocs/op` (`atomic.Pointer` Copy-on-Write) |
| Degradation Drain Convergence | Never drains degraded node automatically | Drains CPU/I/O-spiked node to `< 8%` share within `1.5s` (3 fast-loop ticks) |
| Operating Cost (Live Demo + Control Plane) | Multi-VM cluster cost | `$0/mo` (Vercel Free + Render Free multi-stage Docker) |

---

## 2. Goals (MVP)

1. **Zero-Allocation Lock-Free Go Data Plane & SDK (`proxy-go/pkg/fuzzload`):** Deliver an importable Go SDK and CLI binary (`fuzzload-proxy`) supporting `Round Robin`, `Least Connections`, `Weighted Round Robin`, `ANFIS-Only`, and `FuzzLoad (GP + ANFIS)` with `0 allocs/op` on `SelectUpstream()`, passive circuit breaking, and standalone pure-Go Neuro-Fuzzy + GP auto-adaptation.
2. **Dual-Loop Soft-Computing Control Plane (`backend/`):** Run a 5-layer differentiable Takagi-Sugeno ANFIS network updating premise/consequent weights every `500ms` via online momentum backpropagation, paired with a tree-based Genetic Programming + Bitwise FLC-GA optimizer evolving over a rolling 60-second Digital Twin replay buffer every `6s`, plus `ART1`/`ART2` regime clustering and `Exponential BAM` weight recall.
3. **Python SDK & Multi-Command CLI (`fuzzload`):** Expose `from fuzzload import FuzzLoadRouter` and `fuzzload start | probe | bench` so engineers can embed or test adaptive routing directly from Python or the terminal.
4. **Interactive Observability, Chaos & Real URL Prober UI (`frontend/`):** Ship four dedicated Next.js 16 App Router routes (`/`, `/dashboard`, `/playground`, `/how-it-works`) verified with Playwright smoke + WCAG AA accessibility checks, live telemetry, chaos fault injection, DNS-pinned SSRF-hardened HTTP probing, and CSV/JSON/IEEE LaTeX benchmark exporters.

---

## 3. Non-Goals (Explicit Scope Cuts)

- **Layer-4 Kernel-Space Packet Forwarding (eBPF/XDP)** — Excluded from current scope to stay compatible with unprivileged cloud containers; trigger to revisit is single-host traffic exceeding `100,000 RPS`.
- **Automated Horizontal Auto-Scaling (Kubernetes HPA)** — Excluded; FuzzLoad optimizes traffic distribution across an existing heterogeneous node pool rather than provisioning compute instances.
- **Persistent Time-Series Database (TimescaleDB / Prometheus Server)** — Excluded; lock-free in-memory ring buffers (`128` samples in Go, `120` ticks in Python) keep telemetry sub-microsecond and hosting `$0/mo`.

---

## 4. Users & Personas

- **Primary:** Backend/distributed-systems engineers and researchers evaluating adaptive soft-computing load-balancing strategies or embedding `pkg/fuzzload` / `FuzzLoadRouter` into Go or Python gateways.
- **Secondary:** Technical interviewers, professors, and recruiters inspecting the live interactive chaos console, real HTTP endpoint prober, and verified Go/Python benchmarks at `https://fuzzload.tanisheesh.in`.

---

## 5. User Stories & Acceptance Criteria

### Story 1 — Hot-Swapping Routing Policies Under Chaos (`/dashboard`)
*As a systems engineer, I want to inject CPU/Memory/I/O/Offline faults on any node and switch routing algorithms live so that I can compare tail-latency behavior immediately.*
- **Given** a 4-node heterogeneous cluster running at `420 RPS`, **When** I inject `CPU Spike` + `I/O Lag` on `Node-2` under `fuzzload`, **Then** `Node-2` routing weight drains below `10%` within `1.5s` while cluster P95 stays significantly lower than Round Robin.
- **Given** all 4 worker nodes are toggled `KILL NODE`, **When** the fast loop runs, **Then** the McCulloch-Pitts safety gate inhibits traffic (`0%` share, zero division-by-zero crashes; Go proxy returns `503 Service Unavailable`) and displays a critical banner instructing `[RESET]`.

### Story 2 — Probing Real Live HTTP Endpoints (`/playground`)
*As a developer, I want to benchmark real HTTPS URLs and generate ready-to-paste Go SDK / Python SDK / CLI / Docker gateway configs.*
- **Given** 2–8 public `https://` URLs, **When** I execute an HTTP burst (`POST /api/probe`), **Then** the server measures real P50/P95/P99 latency over DNS-pinned sockets, computes ANFIS + GP routing weights, and pre-populates the 5-tab config generator (`Go SDK`, `CLI`, `JSON`, `Docker`, `Python`).
- **Given** a private/loopback/metadata/IPv4-mapped-IPv6 URL (e.g. `http://127.0.0.1:8000`, `http://[::ffff:7f00:1]:8000`, or `http://169.254.169.254`), **When** submitted to `/api/probe` or `/api/proxy/probe`, **Then** the SSRF guard blocks the request before connecting (`400` / `Blocked`).

### Story 3 — Embedding FuzzLoad in a Standalone Go or Python Service
*As a backend engineer, I want to install the Go SDK or Python SDK without needing the full UI stack.*
- **Given** `go get github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload@v1.0.1`, **When** I call `fuzzload.NewProxy(cfg)` + `proxy.StartAutoControlLoop(ctx, cfg)`, **Then** requests route through `SelectUpstream()` with `0 allocs/op` and automatically drain degraded upstreams on high latency or 5xx circuit trips.

---

## 6. Functional Requirements

### 6.1 Go Data Plane Reverse Proxy & SDK (`proxy-go/`)
- Lock-free `atomic.Pointer[routingTable]` Copy-on-Write swaps for `round_robin`, `least_connections`, `weighted_round_robin`, `anfis_only`, and `fuzzload`.
- Lock-free `[128]atomic.Uint64` latency ring buffer with on-scrape P50/P95/P99 interpolation and Prometheus `/metrics` exposition.
- Passive circuit breaker (trips after `FailureThreshold=3` consecutive 5xx/errors with `5s` cooldown, half-open retry + automatic cooldown refresh) + active `/healthz` recovery prober.
- Standalone pure-Go Gaussian Neuro-Fuzzy + GP auto-tuner (`RecomputeAdaptiveWeights` / `StartAutoControlLoop`) and authorized `AdminHandler()` (`Bearer FUZZLOAD_ADMIN_TOKEN` or loopback).

### 6.2 Python Soft-Computing Control Plane (`backend/`)
- Collect normalized `[CPU, MEM, LAT, CONN]` telemetry vectors every `500ms` (pulling live metrics from Go `GET /api/telemetry` when connected, or falling back seamlessly to the internal Digital Twin simulator).
- Run 5-layer Takagi-Sugeno ANFIS + LR-Type fuzzy sets + Mamdani Centroid + Momentum Backpropagation + `ART1`/`ART2` + `Exponential BAM` recall.
- Run Symbolic Genetic Programming + 12-bit Bitwise FLC-GA structural rule masking every `6s` over the 60-second replay buffer; push updated weights (`POST /api/weights`) and chaos faults (`POST /api/chaos`) to Go.

### 6.3 Observability & Playground UI (`frontend/`)
- Four App Router pages (`/`, `/dashboard`, `/playground`, `/how-it-works`) with explicit live control-plane vs. Digital Twin status badges, clear error handling, responsive layouts (`375px` and `1280px`), and CSV/JSON/IEEE LaTeX export actions.

---

## 7. Edge-Case & Failure Behavior Matrix

| Scenario | Expected System Behavior | User Feedback / Status |
|---|---|---|
| Backend daemon offline (`:8000` unreachable) | Dashboard falls back to client-side Digital Twin (`500ms`) seamlessly | Command bar switches to `ENGINE: DIGITAL TWIN (500ms)` |
| Go proxy offline (`:8080` unreachable) | Python control plane runs calibrated internal queueing simulator | `go_proxy_connected: false`, `telemetry_source: "digital_twin"` |
| All worker nodes marked `offline` or circuit-open | Zero division guarded; Go `SelectUpstream()` returns `nil` | `503 Service Unavailable` + critical narrator banner |
| SSRF / private IP / DNS-rebind / 3xx redirect on probe | Blocked via DNS resolution + IPv4/IPv6/mapped-IPv6 filter + pinned sockets + no-redirect | `400 Bad Request` / `Blocked` status |
| Unauthorized `POST /api/weights` or `/api/chaos` | Rejected by constant-time Bearer token / loopback check | `401 Unauthorized` |
| Non-4-node custom cluster (`FUZZLOAD_UPSTREAMS`) | BAM cleanly skipped when `len(nodes) != 4`; all nodes scored & weighted | Zero `IndexError` or dropped nodes |
| GP mutation produces division by zero or `NaN` | `protected_div`, `protected_exp`, `protected_sqrt` clamp outputs; invalid trees scored `-inf` | Never promoted to live control plane |

---

## 8. Non-Functional Requirements & Budgets

- **Data-Plane Latency:** Target selection `< 0.2ms` (verified `4.8–7.5 ns/op`, `0 B/op`, `0 allocs/op` in CI).
- **Memory Footprint:** Combined Go Proxy + 4 Workers + Python Control Plane stays under `350 MB RAM` to fit Render Free Tier (`512 MB`) and AWS `t3.micro` (`1 GB`).
- **Security:** Pydantic validation on all FastAPI endpoints, TLS 1.2+ enforcement, DNS-pinned SSRF filtering on probe endpoints, restricted `CORS_ORIGINS`, `frontend/vercel.json` HTTP security headers, CodeQL (Go/Python/JS), and Gitleaks CI.
- **Accessibility & Responsiveness:** WCAG 2.1 AA contrast, zero critical/serious `@axe-core/playwright` violations, and zero horizontal scroll at `375px` and `1280px`.

---

## 9. Unit Economics & Quota Budget

| Resource | Free-Tier / Plan Limit | Estimated Usage (Portfolio Demo) | Scaling Note |
|---|---|---|---|
| Frontend Hosting (Vercel Free `bom1`) | 100 GB bandwidth · 100 GB-hrs compute | `< 1 GB/mo` (static prerendered pages + on-demand `/api/probe`) | Docs-only commits ignored via `ignoreBuildStep` |
| Backend Container (Render Free Docker) | 750 hrs/mo · 512 MB RAM | Single multi-stage container (`~180 MB` RAM) | Sleeps after 15m idle; UI Digital Twin hides cold start |
| Go Module Proxy (`pkg.go.dev`) | Unlimited public OSS indexing | Immutable git tag (`proxy-go/v1.0.1`) | Zero hosting cost |

---

## 10. Success Metrics & Instrumentation

| Metric | Target | Verified / How Measured |
|---|---|---|
| Go SDK Hot-Path Routing Overhead | `< 0.2 ms` (`< 200,000 ns`) | **`4.802–7.489 ns/op`, `0 allocs/op`** (`go test -bench=. -benchmem` in CI) |
| P95 Tail-Latency Reduction vs Round Robin | `>= 30%` reduction under Node-2 chaos | **`-69.5%`** (`34.2 ms` vs `112.4 ms`, `bench/run_benchmark.py`) |
| Capacity-Normalized Jain's Fairness | `>= 0.92` | **`0.974`** (`bench/run_benchmark.py`) |
| Automated Quality & Security Gates | 0 test/race/CodeQL/Gitleaks/a11y failures | GitHub Actions `CI` (`go test -race`, `pytest`, `ruff`, `pnpm build`, Playwright), `CodeQL`, `Secret Scan` |

---

## 11. Risks, Assumptions & Open Questions

| Item | Impact | Mitigation / Status |
|---|---|---|
| **Weight Oscillation (Herd Effect)** | High | EMA smoothing (`alpha = 0.45–0.48`) + stochastic proportional CDF routing instead of winner-takes-all |
| **GP Expression Bloat** | Medium | Hard `max_depth = 4` + parsimony pressure penalty during tournament selection |
| **Free-Tier Backend Cold Starts** | Medium | Client-side Digital Twin keeps `/dashboard` interactive immediately while backend wakes |

---

## 12. Future Roadmap

- **eBPF/XDP Kernel Data Plane** — Push ANFIS + GP weights directly into pinned BPF maps for line-rate L4 forwarding once single-host traffic exceeds `100K RPS`.
- **Interval Type-2 Fuzzy Logic** — Model higher-order telemetry jitter via Footprints of Uncertainty (FOU).
- **gRPC Bidirectional Telemetry Streams** — Replace 500ms HTTP JSON sync between Go and Python with streaming protobufs.

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
