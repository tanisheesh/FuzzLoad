# FuzzLoad — Architecture

---

## 1. Stack

| Layer | Tech |
|---|---|
| Frontend Dashboard | Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Recharts · Lucide Icons |
| Data Plane (Reverse Proxy) | Go 1.23 (`net/http/httputil.ReverseProxy` · `sync/atomic` routing table · Goroutines) |
| AI Control Plane | Python 3.12 · FastAPI · Differentiable 5-Layer ANFIS · DEAP Genetic Programming · NumPy |
| Heterogeneous Backend Cluster | 4 Worker Nodes (`node-1` to `node-4` with distinct CPU cores, RAM caps, and I/O profiles) |
| Telemetry & Replay Store | Lock-free In-Memory Ring Buffer (60s rolling window) + optional Redis sync |
| Hosting | Vercel (Frontend) · AWS EC2 `t3.micro` Docker Compose / Render Multi-Stage Docker (Backend) |

---

## 2. Components

```text
FuzzLoad/
  proxy-go/        Go HTTP reverse proxy & multi-node worker cluster binary
  backend/         Python FastAPI AI Control Plane (5-layer ANFIS + DEAP GP + Digital Twin)
  frontend/        Next.js 16 real-time observability & chaos engineering dashboard
  docs/            System architecture, research blueprint, PRD, decisions, setup & deploy guides
```

### Go Reverse Proxy & Worker Cluster (`proxy-go/`)

Receives incoming HTTP client traffic and routes each request in `<0.2ms` using an atomic in-memory routing table. Supports 5 algorithms (`round_robin`, `least_connections`, `weighted_round_robin`, `anfis_only`, `fuzzload`). Also spawns 4 lightweight Go backend worker servers (`:9001`–`:9004`) with configurable CPU capacities, memory ceilings, and chaos fault states. Does not run neural network training or genetic evolution inline.

### Python AI Control Plane (`backend/`)

Runs the dual-loop soft-computing optimization engine and exposes REST + WebSocket APIs for the dashboard. Every `500ms`, the **Fast Loop (5-Layer ANFIS)** pulls node telemetry, computes fuzzy rule firing strengths, updates routing weights, and performs a single online backpropagation step against observed SLA latency. Every `6s`, the **Slow Loop (Genetic Programming)** evolves a population of 40 symbolic expression trees across 15 generations on the 60-second Digital Twin replay buffer and updates the symbolic heuristic $\Phi_{\text{GP}}(\mathbf{x}_i)$. Also includes an integrated async simulation coordinator so the backend can operate standalone or paired with the Go proxy.

### Next.js Observability & Chaos Dashboard (`frontend/`)

Renders the live cluster topology, dynamic routing weight bars, Gaussian membership curves ($\mu_{\text{Low}}, \mu_{\text{Medium}}, \mu_{\text{High}}$), ANFIS backpropagation loss history, the currently active GP symbolic expression tree, and live P50/P95/P99 latency comparison charts. Provides controls to switch algorithms, change traffic profiles, inject node chaos, and run automated comparative benchmarks.

---

## 3. Data Flow

```text
[Traffic Generator / Browser]
        │
        ▼  HTTP Requests
┌───────────────────────────────┐
│   Go Data Plane Proxy (:8080) │ ── Atomic Weight Lookup (<0.2ms) ──► [Worker Nodes :9001..9004]
└───────┬───────────────▲───────┘                                              │
        │               │                                                      │
        │ Telemetry     │ Push Updated Weights                                 │ Per-Request Latency
        │ Snapshot      │ P = [w1, w2, w3, w4]                                 │ CPU / Mem / Conns
        ▼               │                                                      ▼
┌───────────────────────┴──────────────────────────────────────────────────────┐
│                   Python AI Control Plane (:8000)                            │
│                                                                              │
│  [Fast Loop: Every 500ms]                     [Slow Loop: Every 6s]          │
│   1. Fuzzify [CPU, MEM, LAT, CONN]             1. Read 60s Replay Buffer     │
│   2. 5-Layer ANFIS Forward Pass                2. Evaluate 40 GP Syntax Trees│
│   3. Online Backprop on SLA Error              3. Crossover + Mutation       │
│   4. Combine S_ANFIS + Phi_GP ───────────────◄ 4. Promote Elite Formula      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼  WebSocket / JSON Stream (2 Hz)
                 [Next.js 16 Live Dashboard (:3000)]
```

1. **Request Arrival & Forwarding:** Client requests hit the Reverse Proxy, which selects a target backend node $i$ with probability $P_i$ (when in `fuzzload` or `anfis_only` mode) or deterministic rules (`round_robin`, `least_connections`, `weighted_round_robin`).
2. **Telemetry Recording:** Upon response completion, the proxy updates sliding-window P50/P95/P99 latency, active connections, CPU load, memory usage, and error rates for node $i$, appending the trace to the 60-second Digital Twin replay buffer.
3. **ANFIS Fast Loop (500ms):** The 5-layer Neuro-Fuzzy network evaluates Gaussian membership functions for each node, computes Takagi-Sugeno rule outputs, updates premise ($c, \sigma$) and consequent ($p, q, r, s, b$) parameters via gradient descent to penalize SLA violations, and outputs crisp score $S_{\text{ANFIS}}(\mathbf{x}_i)$.
4. **Genetic Programming Slow Loop (6s):** The GP optimizer evolves symbolic mathematical trees on the replay buffer, selecting the expression $\Phi_{\text{GP}}(\mathbf{x}_i)$ that minimizes simulated P95 latency and load variance.
5. **Weight Publication & UI Broadcast:** The combined weight $W_i = \lambda S_{\text{ANFIS}}(\mathbf{x}_i) + (1-\lambda)\Phi_{\text{GP}}(\mathbf{x}_i)$ is smoothed via EMA, normalized into routing probabilities $P_i$, pushed to the proxy routing table, and broadcast to the Next.js dashboard.

---

## 4. State & Telemetry Schema

FuzzLoad operates entirely on real-time in-memory ring buffers for sub-millisecond speed:

- `NodeTelemetry` — `node_id`, `name`, `capacity_cores`, `cpu_usage` ($[0,1]$), `mem_usage` ($[0,1]$), `active_connections`, `p50_latency_ms`, `p95_latency_ms`, `p99_latency_ms`, `error_rate`, `routing_weight`, `requests_served`, `chaos_state` (`cpu_spike`, `mem_leak`, `io_lag`, `offline`).
- `ANFISState` — `epoch`, `learning_rate`, `current_loss`, `membership_curves` (`cpu`, `latency`, `connections` Gaussian centers $c$ and sigmas $\sigma$ for `Low`, `Medium`, `High`), `rule_activations` (top firing Takagi-Sugeno rules).
- `GPEvolutionState` — `generation`, `population_size`, `best_fitness`, `best_expression_str`, `best_expression_tree` (hierarchical AST nodes for UI rendering), `fitness_history`.
- `BenchmarkReport` — Comparative run results across `round_robin`, `least_connections`, `weighted_round_robin`, `anfis_only`, and `fuzzload` (`avg_latency_ms`, `p95_latency_ms`, `p99_latency_ms`, `throughput_rps`, `error_rate_pct`, `jains_fairness_index`).

---

## 5. API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Health check returning control plane, proxy, and worker cluster status |
| `GET` | `/api/state` | Full real-time snapshot of cluster telemetry, ANFIS layers, GP tree, and metrics |
| `POST` | `/api/config/algorithm` | Hot-swaps active routing algorithm (`round_robin`, `least_connections`, `weighted_round_robin`, `anfis_only`, `fuzzload`) |
| `POST` | `/api/config/traffic` | Updates live traffic generator profile (`steady`, `sine_wave`, `flash_crowd`, `chaos_burst`) and RPS |
| `POST` | `/api/chaos/inject` | Injects or clears synthetic faults (`cpu_spike`, `mem_leak`, `io_lag`, `offline`) on a target node |
| `POST` | `/api/gp/evolve` | Triggers an immediate Genetic Programming evolutionary generation cycle |
| `POST` | `/api/benchmark/run` | Runs a comparative benchmark across all 5 algorithms and returns comparative metrics |
| `WS` | `/ws/telemetry` | Streams live cluster, ANFIS, and GP state updates at 2 Hz to the dashboard |

---

## 6. Security

- **Input Validation:** All algorithm switches, traffic intensity settings, and chaos fault injections are strictly validated via Pydantic schemas with bounded numeric ranges (`rps <= 2000`, valid `node_id` enums).
- **Safe Symbolic Evaluation:** Genetic Programming expressions are never evaluated with Python `eval()` on arbitrary user strings; trees are constructed exclusively from a whitelisted primitive set with protected mathematical operators (`protected_div`, `protected_exp`, `protected_sqrt`).
- **CORS & Rate Limiting:** Production API restricts origins to `https://fuzzload.tanisheesh.in` and localhost dev ports.

---

## 7. Error Handling & Reliability

| Failure | Behaviour |
|---|---|
| Backend worker node goes `offline` | Health probe marks node unhealthy; weight is immediately clamped to `0.0` and traffic drains to surviving nodes |
| Numerical overflow (`NaN`/`Inf`) in GP formula | Protected operators clamp outputs to `[-100, 100]`; if a tree still yields `NaN`, fitness is set to $-\infty$ and discarded |
| All servers exceed SLA latency simultaneously | ANFIS normalizes relative scores and falls back to capacity-weighted distribution rather than dropping all weights to zero |
| Go proxy unreachable in single-container mode | Python Control Plane seamlessly runs its internal async cluster & proxy loop so the dashboard remains 100% functional |

---

## 8. Deployment

1. **Frontend (`frontend/`):** Deployed on **Vercel** (`https://fuzzload.tanisheesh.in`), automatically built on every push to `main`.
2. **Backend Cluster (`proxy-go/` + `backend/`):**
   - **Option A (AWS EC2 Free Tier / Minimal Cost):** `docker compose up -d --build` on an AWS EC2 `t3.micro` / `t4g.small` instance runs the Go Proxy, 4 Worker Containers, and Python AI Control Plane.
   - **Option B (Render Free Tier Single Container):** Root multi-stage `Dockerfile` compiles the Go proxy/workers and starts them alongside the FastAPI AI Control Plane inside a single free web service.

---

## 9. Explicit Scope Cuts

- **Kernel-space eBPF packet routing** — Deferred to v2 to keep deployment compatible with standard cloud containers (Render/AWS EC2) without requiring privileged root kernel headers.
- **Persistent PostgreSQL/TimescaleDB storage** — Deferred to v2; a rolling in-memory ring buffer provides zero-latency telemetry access and eliminates external database hosting costs.

---

<div align="center">

<h3>Tanish Poddar &amp; Krish</h3>

<p>
  <strong>Tanish Poddar</strong> ·
  <a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
  <a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square" alt="LinkedIn"></a>
  <a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>
</p>

<p>
  <strong>Krish</strong> ·
  <a href="https://github.com/krish-codess"><img src="https://img.shields.io/badge/GitHub-krish--codess-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="mailto:krishnakulgohel544@gmail.com"><img src="https://img.shields.io/badge/Email-krishnakulgohel544%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>
</p>

</div>
