# FuzzLoad — Complete Research, Architecture & Free-Tier Deployment Blueprint

**Project Title:** FuzzLoad: Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control  
**Author:** Tanish Poddar  

---

## 1. How All Three AI Paradigms Work Together (Fuzzy + Neural + Genetic Programming)

A common question in final-year capstone evaluations is: **"How do Fuzzy Logic, Neural Networks, and Genetic Programming each contribute, and why do we need all three?"**

| Paradigm | Role in FuzzLoad | Timescale | What It Solves |
|---|---|---|---|
| **1. Fuzzy Logic (Takagi-Sugeno Inference)** | Converts noisy, multi-dimensional server telemetry (`CPU`, `RAM`, `Latency`, `Active Connections`) into smooth linguistic degrees (`Low`, `Medium`, `High`) and evaluates `IF-THEN` rules. | Per- cycle (`500ms`) | Eliminates brittle threshold oscillation (e.g., a hard rule at `CPU > 80%` causing rapid flapping between servers). |
| **2. Neural Network (5-Layer Differentiable ANFIS)** | Wraps the Fuzzy Inference System into a 5-layer neural network trained online via **Backpropagation / Gradient Descent** + **Least Squares Estimation (LSE)**. | Fast Loop (`500ms`) | Automatically learns and tunes Gaussian membership centers ($c$), widths ($\sigma$), and rule weights ($p, q, r, s, b$) to minimize real-time P95 latency violations. |
| **3. Genetic Programming (Tree-Based Symbolic Evolution)** | Evolves non-linear mathematical formulas (Syntax Trees) via **Crossover, Mutation, and Tournament Selection** on a 60-second Digital Twin traffic replay buffer. | Slow Loop (`5s–10s`) | Discovers completely new non-linear combinations of metrics when workload patterns shift (e.g., I/O bottlenecks where CPU is low but tail latency explodes). |

---

## 2. Mathematical Formulation (For Report & Viva)

### 2.1 Telemetry Vector
For each backend server $i \in \{1, 2, \dots, N\}$, the telemetry agent collects normalized metrics in $[0, 1]$:

$$\mathbf{x}_i = \left[ \text{CPU}_i,\ \text{MEM}_i,\ \text{LAT}_i,\ \text{CONN}_i,\ \text{ERR}_i \right]$$

### 2.2 5-Layer ANFIS (Neuro-Fuzzy) Architecture
1. **Layer 1 — Fuzzification (Trainable Gaussian Neurons):**
   $$\mu_{A_{m,j}}(x_{i,m}) = \exp\left(-\frac{(x_{i,m} - c_{m,j})^2}{2\sigma_{m,j}^2}\right)$$
   where $c_{m,j}$ (center) and $\sigma_{m,j}$ (spread) are trainable neural parameters.
2. **Layer 2 — Rule Firing Strength (Product T-Norm):**
   $$w_k(\mathbf{x}_i) = \prod_{m=1}^{4} \mu_{A_{m, k_m}}(x_{i,m})$$
3. **Layer 3 — Normalization Layer:**
   $$\bar{w}_k(\mathbf{x}_i) = \frac{w_k(\mathbf{x}_i)}{\sum_{r=1}^{K} w_r(\mathbf{x}_i)}$$
4. **Layer 4 — Adaptive Takagi-Sugeno Consequent Neurons:**
   $$\bar{w}_k f_k(\mathbf{x}_i) = \bar{w}_k \left( p_k \text{CPU}_i + q_k \text{MEM}_i + r_k \text{LAT}_i + s_k \text{CONN}_i + b_k \right)$$
5. **Layer 5 — Defuzzified Output Score & Online Backpropagation:**
   $$S_{\text{ANFIS}}(\mathbf{x}_i) = \text{sigmoid}\left(\sum_{k=1}^{K} \bar{w}_k(\mathbf{x}_i) f_k(\mathbf{x}_i)\right) \times 100$$
   Online Loss Function minimized at each step:
   $$\mathcal{L} = \frac{1}{N} \sum_{i=1}^{N} P_i \cdot \left(\frac{\text{LAT}_i}{\text{SLA}_{\text{target}}}\right)^2 + \eta \cdot \text{Var}(P_1 \cdot \text{Load}_1, \dots, P_N \cdot \text{Load}_N)$$

### 2.3 Genetic Programming (GP) Symbolic Engine
- **Terminal Set ($\mathcal{T}$):** `CPU`, `MEM`, `LAT`, `CONN`, `ERR`, ephemeral random constants $\mathcal{R} \in [-2.0, 2.0]$.
- **Primitive Function Set ($\mathcal{F}$):** `+`, `-`, `*`, `protected_div`, `min`, `max`, `protected_exp`, `protected_sqrt`, `square`.
- **Example Evolved Expression Tree:**
  $$\Phi_{\text{GP}}(\mathbf{x}_i) = \frac{\max(0.05,\ 1 - \text{CPU}_i^2)}{0.2 + \text{LAT}_i \cdot (1 + \text{CONN}_i)}$$
- **Multi-Objective Fitness Function (evaluated on 60s Replay Buffer):**
  $$\text{Fitness}(\Phi) = -\left( 0.50 \cdot \text{P95\_Latency} + 0.25 \cdot \text{Error\_Rate} + 0.15 \cdot \text{Load\_Imbalance} - 0.10 \cdot \text{Throughput} \right)$$

### 2.4 Hybrid Routing Weight Calculation
The final routing probability $P_i$ assigned to server $i$ in the Data Plane is:

$$W_i = \lambda \cdot S_{\text{ANFIS}}(\mathbf{x}_i) + (1 - \lambda) \cdot \text{norm}\left(\Phi_{\text{GP}}(\mathbf{x}_i)\right), \quad P_i = \frac{W_i}{\sum_{j=1}^{N} W_j}$$

---

## 3. Tech Stack Alternatives & Comparison

Here are the **3 best Tech Stack options** for building FuzzLoad, ranked by ease of free deployment, performance, and academic impact:

### Option 1: Unified Python Async Backend + Next.js 16 Frontend (Best for 100% Free Cloud Deployment)
- **Frontend (UI):** `Next.js 16 (App Router, TypeScript)` + `Tailwind CSS v4` + `shadcn/ui` + `React Flow` (live animated packet routing topology) + `Recharts` (real-time telemetry & membership curves).
- **Backend (All-in-One Engine):** `Python 3.12` + `FastAPI` + `uv` + `httpx` (Async Reverse Proxy) + `PyTorch` (5-Layer ANFIS) + `DEAP` (Genetic Programming) + `WebSockets` (real-time streaming to UI).
- **Simulated Heterogeneous Cluster:** Built-in multi-worker async server cluster inside the backend process (plus optional multi-container `docker-compose.yml` for local demos).
- **Why this wins for Free Deployment:** Running 6 separate services (Proxy + AI + 4 Backend Nodes) on cloud providers usually costs money. By running an **in-process virtual cluster + async proxy** inside one FastAPI service (while still supporting multi-container Docker locally), the entire backend deploys for **$0/month** on a single Free Web Service!

### Option 2: Go (Golang) Data Plane + Python AI Control Plane + Next.js 16 Frontend (Best for High-Performance Systems Flex)
- **Data Plane (Reverse Proxy):** `Go 1.23` (`net/http/httputil.ReverseProxy` + Lock-free atomic weight table + Gorilla WebSockets).
- **Control Plane (AI Engine):** `Python 3.12` (`PyTorch` + `DEAP` + `FastAPI`).
- **Frontend (UI):** `Next.js 16` + `Tailwind CSS` + `shadcn/ui` + `React Flow`.
- **How to deploy for Free:** Pack both the compiled Go binary and the Python AI engine into a **single multi-stage `Dockerfile`** (managed by a lightweight process supervisor or starting Go from Python) and deploy on **Hugging Face Spaces (Docker)** or **Render Free Tier**.

### Option 3: Rust (`Axum`/`Tokio`) Proxy + Python AI Control Plane + Next.js Frontend
- **Data Plane:** `Rust` (`Axum` + `Reqwest` + `Tokio` async runtime).
- **Control Plane:** `Python 3.12` (`PyTorch` + `DEAP`).
- **Tradeoff:** Highest theoretical RPS, but slower iteration and longer Docker build times on free CI/CD runners.

---

## 4. Module-by-Module Breakdown (Where Everything Lives & How It Works)

```text
FuzzLoad/
├── frontend/                        # Next.js 16 Dashboard (Deployed on Vercel)
│   ├── src/app/                     # App Router pages & layouts
│   ├── src/components/
│   │   ├── topology/                # React Flow live animated load balancer -> server nodes
│   │   ├── neuro-fuzzy/             # Live Gaussian membership curves & ANFIS 5-layer inspector
│   │   ├── genetic-prog/            # Live GP AST expression tree visualizer & generation fitness plot
│   │   ├── chaos-panel/             # One-click fault injection (CPU spike, I/O stall, node crash)
│   │   └── benchmarks/              # Live P50/P95/P99 latency comparison (RR vs LC vs WRR vs FuzzLoad)
│   └── package.json
│
├── backend/                         # Unified Data + Control Plane (Deployed on Render / HF Spaces)
│   ├── app/
│   │   ├── main.py                  # FastAPI entrypoint + WebSocket telemetry broadcaster
│   │   ├── proxy/                   # Async HTTP Reverse Proxy & routing algorithms
│   │   │   ├── router.py            # Round Robin, Least Conn, Weighted RR, ANFIS, FuzzLoad
│   │   │   └── telemetry.py         # Sliding window P50/P95/P99 latency & error tracker
│   │   ├── ai_engine/
│   │   │   ├── anfis.py             # 5-Layer Differentiable Neuro-Fuzzy Network (PyTorch/NumPy)
│   │   │   ├── gp_optimizer.py      # DEAP Symbolic Tree Evolution + Crossover/Mutation
│   │   │   ├── replay_buffer.py     # 60s Digital Twin traffic simulator for safe GP fitness eval
│   │   │   └── controller.py        # Dual-loop background coordinator (500ms ANFIS + 8s GP)
│   │   ├── cluster/
│   │   │   ├── virtual_nodes.py     # 4 Heterogeneous Server Nodes (CPU, Mem, I/O queue models)
│   │   │   └── chaos.py             # Fault injector (synthetic CPU load, memory leak, latency spike)
│   │   └── benchmarks/
│   │       └── runner.py            # Automated comparative benchmark runner (RR vs LC vs FuzzLoad)
│   ├── Dockerfile                   # Production container for Render / Hugging Face Spaces
│   └── pyproject.toml / requirements.txt
│
├── worker_node/                     # Standalone Backend Microservice (for multi-container Docker mode)
│   └── server.py                    # Real HTTP server with CPU/IO endpoints & psutil telemetry
│
└── docker-compose.yml               # Local 7-container cluster (Proxy + AI + 4 Workers + Frontend)
```

---

## 5. 100% Free Hosting & Deployment Architecture

To keep the entire project **100% Free ($0/month)** while supporting a live interactive URL (`https://fuzzload.tanisheesh.in`) that recruiters and professors can test anytime:

```text
   User / Examiner Browser
             │
             ▼
┌──────────────────────────────────────────┐
│  https://fuzzload.tanisheesh.in          │
│  Hosted on: Vercel (Free Plan)           │
│   DNS: GoDaddy CNAME via setup-toolkit    │
└────────────────────┬─────────────────────┘
                     │ HTTPS REST + WebSockets (WSS)
                     ▼
┌──────────────────────────────────────────┐
│  FuzzLoad Backend Engine (Docker/Python) │
│  Option A: Render (Free Web Service)     │
│  Option B: Hugging Face Spaces (Free     │
│            Docker - 2 vCPU, 16 GB RAM!)  │
│                                          │
│  Runs:                                   │
│  1. Async Reverse Proxy Data Plane       │
│  2. 5-Layer ANFIS Neuro-Fuzzy Loop       │
│  3. DEAP Genetic Programming Loop        │
│  4. 4 Heterogeneous Backend Nodes        │
│  5. Live Traffic & Chaos Simulator       │
└──────────────────────────────────────────┘
```

### Why this Dual-Mode (Cloud + Local Docker) Design is Ideal:
1. **For Recruiters & Live Portfolio (`fuzzload.tanisheesh.in`):** Anyone opening the link immediately sees live traffic flowing, can switch algorithms (`Round Robin` -> `FuzzLoad`), click **"Inject Chaos Spike on Node 2"**, and watch the Neuro-Fuzzy weights and Genetic Programming syntax tree adapt in real time over WebSockets.
2. **For 4th-Year Capstone Viva / Local Evaluation (`docker compose up`):** You can also spin up separate Docker containers with real Linux CPU/Memory cgroup limits (`0.5 CPU`, `1.0 CPU`, `2.0 CPU`) and generate load across them.

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hey%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
