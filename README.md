<p align="center">
  <img src="docs/logo.svg" width="64" height="64" alt="FuzzLoad logo">
</p>

<h1 align="center">FuzzLoad</h1>

<p align="center">
  <strong>Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control</strong>
</p>

<p align="center">
  <a href="https://fuzzload.tanisheesh.in">
    <img src="https://img.shields.io/badge/live_demo-FF5500-FF5500?style=flat-square" alt="Live Demo">
  </a>
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white" alt="PyTorch">
  <img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazon-aws&logoColor=white" alt="AWS">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-FF5500?style=flat-square" alt="License"></a>
</p>

---

## What is FuzzLoad?

Traditional reverse-proxy load balancers rely on static heuristics like Round Robin or Least Connections that fail when heterogeneous servers face bursty traffic, noisy-neighbor contention, or non-linear I/O bottlenecks. **FuzzLoad** decouples a high-throughput **Go (Golang) Reverse Proxy Data Plane** from a dual-loop **Python Soft-Computing Control Plane**: a **5-Layer Adaptive Neuro-Fuzzy Inference System (ANFIS)** adjusts server routing weights every 500ms using online backpropagation, while a **Genetic Programming (GP)** engine evolves symbolic scoring expressions in the background against a 60-second Digital Twin traffic replay buffer.

> **Live demo →** [https://fuzzload.tanisheesh.in](https://fuzzload.tanisheesh.in)

---

## What you get

- **5-Layer Neuro-Fuzzy (ANFIS) Controller** — Fuzzifies noisy server telemetry (`CPU`, `RAM`, `Latency`, `Connections`) into Gaussian membership curves and trains rule weights online via gradient descent every 500ms.
- **Genetic Programming (GP) Symbolic Optimizer** — Evolves mathematical expression trees (`DEAP`) over a 60-second Digital Twin traffic replay buffer to discover optimal non-linear routing heuristics without risking live traffic.
- **High-Throughput Go Reverse Proxy** — Lock-free atomic routing table (`httputil.ReverseProxy`) supporting hot-swappable algorithms (`Round Robin`, `Least Connections`, `Weighted RR`, `ANFIS-Only`, and `FuzzLoad GP+ANFIS`) with `<0.2ms` routing overhead.
- **Interactive Chaos & Topology Dashboard** — Visualize real-time packet routing, fuzzy membership shifts, GP syntax tree evolution, and P95/P99 tail-latency benchmarks while injecting synthetic CPU spikes or network lag.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Recharts · Lucide Icons |
| Data Plane (Proxy) | Go 1.23 (`net/http/httputil` · Atomic Weight Table · Goroutine Worker Pool) |
| AI Control Plane | Python 3.12 · FastAPI · Differentiable 5-Layer ANFIS · DEAP Genetic Programming · NumPy |
| Cluster & Telemetry | Heterogeneous Go/Python Worker Nodes · Sliding-Window P50/P95/P99 Telemetry · Chaos Injector |
| Infra & Deployment | Vercel (Frontend) · AWS EC2 Free Tier / Render Multi-Stage Docker (Backend Cluster) |

---

## Engineering Decisions

**Why write the Data Plane in Go and the AI Control Plane in Python?**
Python's Global Interpreter Lock (GIL) and garbage collection pauses introduce tail-latency jitter in high-concurrency HTTP reverse proxies. Writing the reverse proxy and worker nodes in Go provides `<0.2ms` lock-free request forwarding and a `~15MB` memory footprint, while Python handles vectorized 5-layer ANFIS backpropagation and DEAP symbolic tree evolution asynchronously out-of-band.

**Why combine Fuzzy Logic, Neural Networks, and Genetic Programming instead of Deep RL?**
Deep Reinforcement Learning (PPO/DQN) behaves as an uninterpretable black box and can make catastrophic routing decisions during unseen traffic spikes. Fuzzy Logic bounds uncertainty in raw telemetry, the 5-layer ANFIS neural network adapts membership parameters smoothly via gradient descent, and Genetic Programming evolves human-readable mathematical expressions that can be audited in real time.

**Why evaluate Genetic Programming trees on a Digital Twin Replay Buffer instead of live servers?**
Testing randomly mutated GP formulas directly on production traffic would route requests to overloaded nodes when low-fitness individuals are evaluated. Simulating each generation against the last 60 seconds of recorded telemetry allows 50+ generations to evolve in milliseconds with zero impact on live traffic.

**What would you do differently in v2?**
Move the data-plane packet forwarding into an eBPF/XDP kernel-bypass layer reading routing weights directly from pinned BPF maps updated by the Python AI control plane.

---

## Docs

| Document | Description |
|---|---|
| [Research & System Blueprint](docs/BLUEPRINT.md) | Complete B.Tech capstone research guide, mathematical formulation, and AWS/Render deployment plan |
| [PRD](docs/PRD.md) | Product requirements — problem statement, goals, user stories, non-goals |
| [Architecture](docs/ARCHITECTURE.md) | System design, Go Data Plane + Python Control Plane data flow, ANFIS & GP pipeline |
| [Decisions](docs/DECISIONS.md) | Every major architectural and algorithmic decision and why |
| [Setup](docs/SETUP.md) | Local development setup and cluster execution |
| [Deploy](docs/DEPLOY.md) | Production deployment on Vercel, AWS EC2, and Render |
| [Contributing](CONTRIBUTING.md) | How to propose changes |
| [Changelog](CHANGELOG.md) | What changed in each release |
| [Security](SECURITY.md) | How to report a vulnerability |

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

<h3>Krish Gohel</h3>

<a href="https://github.com/krish-codess"><img src="https://img.shields.io/badge/GitHub-krish--codess-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:krishnakulgohel544@gmail.com"><img src="https://img.shields.io/badge/Email-krishnakulgohel544%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
