# FuzzLoad — Product, Architecture & Execution Plan (`PLAN.md`)

**Project:** FuzzLoad — Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control  
**Owners:** Tanish Poddar (`tanisheesh.in`) & Krish Gohel (`github.com/krish-codess`)  
**Target Bar:** Portfolio Flagship (`Reqly` / `DiffHawk` / `NetPulse AI` tier) + Final-Year B.Tech CSE Capstone Research System  

---

## 0. Why This Plan Exists

Most academic load-balancing projects are single-page toy scripts that only plot simulated charts, while most open-source proxies (Nginx, HAProxy, Traefik) use static heuristics (`Round Robin`, `Least Connections`) that cannot learn from tail-latency spikes or non-linear I/O bottlenecks.

**The Gap FuzzLoad Fills:**
1. **As a Portfolio Product (like `Reqly` & `DiffHawk`):** A real, shippable developer tool with a dedicated **Product Landing Page (`/`)**, an interactive **Live Cluster & Chaos Demo (`/dashboard`)**, a **"Bring Your Own Endpoints" Real HTTP Proxy Playground (`/playground`)**, an **Engineering & Math Deep-Dive (`/how-it-works`)**, an installable **CLI/SDK (`fuzzload`)**, and reproducible benchmarks (`bench/README.md`).
2. **As a 4th-Year CSE Research Capstone:** A genuine soft-computing control plane combining all three paradigms:
   - **Fuzzy Logic (Takagi-Sugeno Type-1):** Smooth Gaussian membership functions ($\mu_{\text{Low}}, \mu_{\text{Medium}}, \mu_{\text{High}}$) over `CPU`, `Memory`, `Latency`, and `Active Connections`.
   - **Neural Networks (5-Layer Differentiable ANFIS):** Online analytical gradient descent updating premise centers ($c$), spreads ($\sigma$), and linear consequent weights ($p, q, r, s, b$) every `500ms`.
   - **Genetic Programming (Symbolic Regression):** Tree-based evolutionary optimization (`Tournament Selection`, `Subtree Crossover`, `Point/Subtree Mutation`, `Parsimony Pressure`) running every `6s` over a 60-second Digital Twin traffic replay buffer.

---

## 1. Multi-Page Information Architecture (Separated Landing Page vs Demo vs Playground)

Instead of cramming everything into a single screen, the web application (`fuzzload.tanisheesh.in`) is structured into **4 dedicated routes**:

```text
https://fuzzload.tanisheesh.in
├── /                 → Product Landing Page (Pitch, Architecture, Quickstart CLI/SDK, Benchmark Highlights)
├── /dashboard        → Live Cluster & Chaos Console (4 Heterogeneous Nodes, 2Hz Telemetry, ANFIS/GP Visualizers)
├── /playground       → Real HTTP Upstream Proxy Tester (Plug your own URLs, run live HTTP bursts, export config)
└── /how-it-works     → Interactive Mathematical & Systems Deep-Dive (5-Layer ANFIS, GP AST Crossover, Viva Guide)
```

### 1.1 Route `/` — Product Landing Page (`frontend/src/app/page.tsx`)
Designed for recruiters, engineers, and professors who land on `fuzzload.tanisheesh.in` for the first 10 seconds:
- **Sticky Navigation Bar:** Logo, links to `Features`, `Architecture`, `Benchmarks`, `How It Works`, `Playground`, `GitHub`, and primary CTA **`Launch Live Demo →` (`/dashboard`)**.
- **Hero Section:**
  - Bold headline: *"Stop Routing Traffic Blindly. Evolve Your Load Balancer in Real Time."*
  - Split view: Left side has the product pitch + CTAs (`Launch Live Demo →`, `Try Real Proxy Playground`, `View on GitHub`); Right side shows a live interactive terminal & mini routing weight preview.
- **Metrics & Proof Strip:**
  - `< 0.2 ms` Go Data-Plane Routing Overhead
  - `500 ms` 5-Layer ANFIS Online Backpropagation Loop
  - `-69.5%` P95 Tail-Latency Reduction vs Round Robin under Chaos
  - `0.974` Jain's Capacity-Normalized Fairness Index
- **The 3-Engine Architecture Section:** Visual breakdown of how **Fuzzy Logic + 5-Layer Neural Network (ANFIS) + Genetic Programming** cooperate with the **Go Reverse Proxy**.
- **"Use FuzzLoad in Your Own Project" (Developer Quickstart):**
  - Tab 1: **Standalone Reverse Proxy CLI** (`fuzzload start --upstreams http://localhost:4001,http://localhost:4002 --port 8080`)
  - Tab 2: **Python SDK / FastAPI Integration** (`from fuzzload import FuzzLoadRouter`)
  - Tab 3: **Docker Compose Sidecar** (`ghcr.io/tanisheesh/fuzzload`)
- **Head-to-Head Benchmark Summary Table:** Real numbers comparing `Round Robin`, `Least Connections`, `Weighted Round Robin`, `ANFIS-Only`, and `FuzzLoad (GP + ANFIS)`.

### 1.2 Route `/dashboard` — Live Cluster & Chaos Engineering Demo (`frontend/src/app/dashboard/page.tsx`)
The dedicated real-time observability & chaos testbed:
- **Control Header:** Switch live between all 5 routing policies, 4 traffic profiles (`Sine Wave`, `Steady`, `Flash Crowd`, `Chaos Burst`), RPS slider, `Evolve GP (+5 Gen)` trigger, and **1-Click Export (`CSV`, `JSON`, `IEEE LaTeX Table`)**.
- **4 Heterogeneous Server Cards:** Live routing share (`P_i %`), CPU/RAM usage, P50/P95/P99 latency, ANFIS score, GP score, and per-node **Chaos Fault Injection buttons** (`CPU Spike`, `I/O Lag`, `Mem Leak`, `Offline`).
- **AI SRE Telemetry Narrator:** Deterministic root-cause explanation banner that narrates *why* weights shifted (e.g., *"Node-2 P95 spiked to 148ms after CPU fault; ANFIS Rule #6 fired w̄=0.39, draining Node-2 weight from 24% → 6% in 1.0s"*).
- **Live Charts & Inspectors:**
  1. Real-time P95 Tail Latency AreaChart (`FuzzLoad` vs `Least Connections` vs `Round Robin`).
  2. Layer-1 Fuzzy Gaussian Membership Function Plot ($\mu_{\text{Low}}, \mu_{\text{Medium}}, \mu_{\text{High}}$) + Top Firing Rules.
  3. Genetic Programming Evolved Mathematical Formula + Interactive AST Syntax Tree Visualizer.
  4. 5-Algorithm Comparative Benchmark BarChart & Table.

### 1.3 Route `/playground` — Real Upstream Proxy & BYO-Endpoint Lab (`frontend/src/app/playground/page.tsx`)
Proves that FuzzLoad is not just a simulator, but a usable reverse proxy tool:
- **Custom Upstream Pool Builder:** Add any real HTTP endpoints (or local microservice ports like `http://localhost:9001..9004`) with custom capacity weights.
- **Live HTTP Burst Runner:** Fire a real batch of requests through the backend proxy (`/api/proxy/test-burst`), measuring actual response times, status codes, and watching ANFIS + GP compute optimal routing weights for those real endpoints.
- **Config & Command Generator:** Generates a ready-to-copy `fuzzload.config.json`, `docker-compose.yml` snippet, and Python SDK snippet pre-filled with the user's upstream URLs.

### 1.4 Route `/how-it-works` — Interactive Math & Architecture Deep-Dive (`frontend/src/app/how-it-works/page.tsx`)
Built specifically for technical interviewers and 4th-year B.Tech Viva examiners:
- Layer-by-layer visual diagram of the **5-Layer Takagi-Sugeno ANFIS Network** with exact equations.
- Step-by-step explanation of **Online Analytical Backpropagation** (how premise parameters $c, \sigma$ and consequent weights $p, q, r, s, b$ update).
- Visual breakdown of **Genetic Programming Tree Crossover, Mutation, Parsimony Pressure, and the 60s Digital Twin Replay Buffer**.
- Data Plane (Go) vs Control Plane (Python) decoupling architecture.

---

## 2. Backend, SDK & Benchmark Architecture

```text
FuzzLoad/
├── proxy-go/                        # Go 1.22 High-Throughput Reverse Proxy & Worker Nodes
│   ├── cmd/fuzzload-proxy/main.go   # Lock-free atomic weight table + httputil.ReverseProxy
│   ├── go.mod
│   └── Dockerfile
├── backend/                         # Python 3.12 FastAPI AI Control Plane + Installable SDK/CLI
│   ├── app/
│   │   ├── ai_engine/
│   │   │   ├── anfis.py             # 5-Layer Differentiable ANFIS + Online Backprop
│   │   │   └── gp_optimizer.py      # Tree-based Genetic Programming + Digital Twin Evaluator
│   │   ├── cluster/
│   │   │   └── simulator.py         # Heterogeneous cluster, chaos engine, real HTTP prober
│   │   ├── cli.py                   # `fuzzload` CLI & Python SDK router for external projects
│   │   └── main.py                  # FastAPI REST + WebSocket + Real Upstream Probe API
│   └── tests/
│       └── test_fuzzload.py         # Unit & integration tests for ANFIS, GP, Chaos, and Proxy
├── frontend/                        # Next.js 15/16 App Router (TypeScript + Tailwind + Recharts)
│   └── src/
│       ├── app/
│       │   ├── page.tsx             # `/` — Product Landing Page
│       │   ├── dashboard/page.tsx   # `/dashboard` — Live Cluster & Chaos Console
│       │   ├── playground/page.tsx  # `/playground` — Real Upstream Proxy & Config Generator
│       │   └── how-it-works/page.tsx# `/how-it-works` — Math & Architecture Deep-Dive
│       ├── components/
│       │   └── Navbar.tsx           # Shared navigation across all 4 routes
│       └── lib/
│           └── fuzzload-engine.ts   # Shared TypeScript types + Digital Twin fallback engine
└── bench/                           # Reproducible Benchmark Suite (like `reqly/bench/`)
    ├── run_benchmark.py             # Runs 2,000 requests across all 5 algorithms & prints report
    └── README.md                    # Verified benchmark methodology & latency tables
```

---

## 3. Execution Roadmap & Status

| Phase | Deliverable | Status |
|---|---|---|
| **Phase 1** | Core 5-Layer ANFIS Engine (`anfis.py`) + Tree-Based GP Symbolic Optimizer (`gp_optimizer.py`) | ✅ Done |
| **Phase 2** | Go Data Plane Reverse Proxy (`proxy-go/`) + Multi-Node Worker Pool | ✅ Done |
| **Phase 3** | Separate Product Landing Page (`/`) from Live Demo (`/dashboard`), Playground (`/playground`), and Deep-Dive (`/how-it-works`) | 🚀 In Progress |
| **Phase 4** | Add Real Upstream Prober API (`/api/proxy/probe`), AI SRE Event Narrator, and CSV/JSON/LaTeX Benchmark Exporter | 🚀 In Progress |
| **Phase 5** | Add `fuzzload` Python SDK/CLI (`backend/app/cli.py`) + Reproducible Benchmark Suite (`bench/README.md`) | 🚀 In Progress |
| **Phase 6** | Verify all tests (`pytest`, `tsc --noEmit`, `next build`) & commit cleanly in `setup-toolkit` format | 🚀 Next |

---

## 4. Free & Minimal-Cost Deployment Strategy

1. **Frontend (`frontend/`):** Hosted on **Vercel (Free)** at `https://fuzzload.tanisheesh.in`. Includes the client-side Digital Twin engine so `/`, `/dashboard`, `/playground`, and `/how-it-works` work instantaneously with zero cold-start failures even if the backend container is sleeping.
2. **Backend (`proxy-go/` + `backend/`):**
   - **Option A (Render Free Tier — $0/month):** Uses the root multi-stage `Dockerfile` + `render.yaml` to compile the Go binary and run it alongside FastAPI in a single container.
   - **Option B (AWS EC2 Free Tier `t3.micro` — $0/month for 12 months, or ~$3/month Spot):** Uses `docker-compose.yml` to run the Go Proxy, Python AI Control Plane, and Dashboard with container isolation.
