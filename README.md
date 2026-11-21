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
  <a href="https://github.com/tanisheesh/FuzzLoad/actions/workflows/ci.yml">
    <img src="https://github.com/tanisheesh/FuzzLoad/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="https://github.com/tanisheesh/FuzzLoad/actions/workflows/codeql.yml">
    <img src="https://github.com/tanisheesh/FuzzLoad/actions/workflows/codeql.yml/badge.svg" alt="CodeQL">
  </a>
  <a href="https://pkg.go.dev/github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload">
    <img src="https://img.shields.io/badge/Go_SDK-pkg.go.dev-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go Reference">
  </a>
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
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
- **High-Throughput Go Reverse Proxy & SDK (`proxy-go/pkg/fuzzload`)** — Lock-free Copy-on-Write (`atomic.Pointer`) routing table and zero-allocation latency ring buffer (`7.49 ns/op`, `0 B/op`, `0 allocs/op` verified in CI) with passive circuit breaking, Prometheus `/metrics`, and hot-swappable algorithms (`Round Robin`, `Least Connections`, `Weighted RR`, `ANFIS-Only`, and `FuzzLoad GP+ANFIS`).
- **Interactive Chaos & Topology Dashboard** — Visualize real-time packet routing, fuzzy membership shifts, GP syntax tree evolution, and P95/P99 tail-latency benchmarks while injecting synthetic CPU spikes or network lag.

---

## By the numbers

| Metric | Value | Source |
|---|---|---|
| Go SDK Hot-Path Lookup (`SelectUpstream`) | `4.8–7.5 ns/op` · `0 B/op` · `0 allocs/op` | `proxy-go/pkg/fuzzload/router_test.go` (GitHub Actions CI) |
| Go Latency Ring Write (`LatencyRing.Record`) | `14.9–45.1 ns/op` · `0 B/op` · `0 allocs/op` | `proxy-go/pkg/fuzzload/telemetry.go` (GitHub Actions CI) |
| P95 Tail-Latency Reduction (480 RPS + Chaos) | `-69.5%` (`34.2 ms` vs `112.4 ms` Round Robin) | `bench/run_benchmark.py` · `bench/README.md` |
| Capacity-Normalized Jain's Fairness | `0.974` (`0.04%` error rate) | `bench/run_benchmark.py` |
| Automated Verification Suite | `5` Go race tests + `1` GoDoc example + `9` Python tests + CodeQL + Gitleaks | `.github/workflows/` |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · Recharts 3 |
| Data Plane & Go SDK | Go 1.23 (`net/http/httputil` · `atomic.Pointer` · `LatencyRing` · `pkg/fuzzload@v1.0.0`) |
| AI Control Plane & Python SDK | Python 3.12 · FastAPI · Pydantic v2 · 5-Layer ANFIS · Symbolic GP · ART1/ART2/BAM · `fuzzload` CLI |
| Cluster & Telemetry | Heterogeneous Go Workers · Sliding-Window P50/P95/P99 · Prometheus `/metrics` · Chaos Injector |
| Infra & Security | Vercel (`bom1`, security headers) · Multi-Stage Docker / Render · CodeQL · Gitleaks · Renovate (`Yantra [bot]`) |

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
| [Usage & SDK Reference](docs/USAGE.md) | Go SDK (`pkg/fuzzload`), Python SDK (`fuzzload`), CLI commands, and HTTP/WS API reference |
| [Setup](docs/SETUP.md) | Local development setup and cluster execution |
| [Deploy](docs/DEPLOY.md) | Production deployment on Vercel, AWS EC2, and Render |
| [Benchmarks](bench/README.md) | Verified Go hot-path microbenchmarks and 5-policy comparative latency results |
| [Agent Guidelines](AGENTS.md) | Runtime coding, security, UI craft, and verification contract |
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

</div>
