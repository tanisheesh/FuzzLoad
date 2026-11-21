<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"
       fill="none" stroke="#FF5500" stroke-width="1.5"
       stroke-linecap="round" stroke-linejoin="round">
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
    <line x1="6" x2="6.01" y1="6" y2="6"/>
    <line x1="6" x2="6.01" y1="18" y2="18"/>
  </svg>
</p>

<h1 align="center">FuzzLoad</h1>

<p align="center">
  <strong>Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control</strong>
</p>

<p align="center">
  <a href="https://fuzzload.tanisheesh.in">
    <img src="https://img.shields.io/badge/live_demo-visit-FF5500?style=flat-square" alt="Live Demo">
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

Static reverse-proxy load balancers rely on fixed heuristics like Round Robin or Least Connections that keep routing traffic into CPU-spiked or I/O-stalled servers. **FuzzLoad** decouples a zero-allocation **Go Reverse Proxy & SDK** (`pkg/fuzzload`) from an out-of-band **Python Soft-Computing Control Plane**: a **5-Layer Adaptive Neuro-Fuzzy Inference System (ANFIS)** adapts routing weights every `500ms` via online momentum backpropagation, while **Genetic Programming (GP)** evolves symbolic scoring trees every `6s` over a 60-second Digital Twin replay buffer.

> **Live demo →** [https://fuzzload.tanisheesh.in](https://fuzzload.tanisheesh.in)

---

## What you get

- **Lock-Free Go Reverse Proxy & Published SDK (`proxy-go/pkg/fuzzload@v1.0.1`)** — Copy-on-Write `atomic.Pointer` routing table (`4.8–7.5 ns/op`, `0 B/op`, `0 allocs/op`), lock-free latency ring buffer, passive circuit breaker, Prometheus `/metrics`, and standalone pure-Go adaptive mode.
- **5-Layer Neuro-Fuzzy (ANFIS) Fast Control Loop** — Maps `CPU`, `RAM`, `Latency`, and `Connections` into Gaussian + LR-Type membership sets, updates premise/consequent weights online every `500ms`, and cooperates with `ART1`/`ART2` clustering and `Exponential BAM` recall.
- **Symbolic Genetic Programming + Bitwise FLC-GA Slow Loop** — Evolves human-readable mathematical expression trees and a 12-bit structural rule mask offline against a rolling 60-second telemetry replay buffer before promoting elite weights.
- **Python SDK, CLI & Interactive Chaos Console** — Embed `from fuzzload import FuzzLoadRouter`, run `fuzzload start | probe | bench`, or test faults and real public HTTP endpoints live across `/dashboard` and `/playground`.

---

## By the numbers

| Metric | Value | Source |
|---|---|---|
| Go SDK Hot-Path Lookup (`SelectUpstream`) | `4.8–7.5 ns/op` · `0 B/op` · `0 allocs/op` | `proxy-go/pkg/fuzzload/router_test.go` (GitHub Actions CI) |
| Go Latency Ring Write (`LatencyRing.Record`) | `14.9–45.1 ns/op` · `0 B/op` · `0 allocs/op` | `proxy-go/pkg/fuzzload/telemetry.go` (GitHub Actions CI) |
| P95 Tail-Latency Reduction (480 RPS + Chaos) | `-69.5%` (`34.2 ms` vs `112.4 ms` Round Robin) | `bench/run_benchmark.py` · `bench/README.md` |
| Capacity-Normalized Jain's Fairness | `0.974` (`0.04%` error rate) | `bench/run_benchmark.py` |
| Automated Verification Suite | `7` Go race tests + `1` GoDoc example + `10` Python tests + Playwright E2E/a11y + CodeQL + Gitleaks | `.github/workflows/` |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · Recharts 3 |
| Data Plane & Go SDK | Go 1.23 (`net/http/httputil` · `atomic.Pointer` · `LatencyRing` · `pkg/fuzzload@v1.0.1`) |
| AI Control Plane & Python SDK | Python 3.12 · FastAPI · Pydantic · Pure-Python 5-Layer ANFIS, Symbolic GP & ART/BAM · `fuzzload` CLI |
| Cluster & Telemetry | Heterogeneous Go Workers · Sliding-Window P50/P95/P99 · Prometheus `/metrics` · Chaos Injector |
| Infra & Security | Vercel (`bom1`, security headers) · Multi-Stage Docker / Render · CodeQL · Gitleaks · Renovate (`Yantra [bot]`) |

---

## Engineering Decisions

**Why decouple the Go Data Plane from the Python AI Control Plane?**
Running neural backpropagation or symbolic tree evaluation synchronously inside an HTTP handler adds milliseconds of jitter per request. Keeping request forwarding on a lock-free Go `atomic.Pointer` table achieves `4.8–7.5 ns/op` (`0 allocs/op`), while Python updates weights asynchronously every `500ms` (or pure Go adapts standalone via `StartAutoControlLoop`).

**Why combine Neuro-Fuzzy (ANFIS) and Genetic Programming instead of Deep RL?**
Deep Reinforcement Learning (PPO/DQN) behaves as an opaque black box and can explore catastrophically during unseen traffic spikes. Gaussian fuzzy rules provide zero-epoch cold-start safety, 5-layer ANFIS adapts smoothly via gradient descent, and Genetic Programming evolves explicit mathematical formulas engineers can audit directly.

**Why evaluate Genetic Programming trees on a 60s Digital Twin Replay Buffer instead of live traffic?**
Mutated candidate trees can produce unstable scores before selection. Evaluating 36 candidate trees offline against the rolling 60-second replay buffer takes under `40ms` and ensures only verified high-fitness formulas are promoted into live routing.

**What would you improve next?**
Move L4 packet forwarding into a Linux eBPF/XDP kernel-bypass program reading weights from pinned BPF maps once single-host traffic exceeds `100K RPS`, upgrade Type-1 Gaussian sets to Interval Type-2 Fuzzy Logic for high-variance multi-AZ jitter, and switch the 500ms HTTP control sync to streaming gRPC protobufs.

---

## Docs

| Document | Description |
|---|---|
| [PRD](docs/PRD.md) | Product requirements — quantified impact, acceptance criteria, edge cases, unit economics |
| [Architecture](docs/ARCHITECTURE.md) | System topology (Mermaid), API contracts, ring-buffer schema, soft-computing pipeline, scale ceilings |
| [Decisions](docs/DECISIONS.md) | Technical ADRs — comparison matrices, tradeoffs, and reversal triggers |
| [Usage](docs/USAGE.md) | Go SDK (`pkg/fuzzload`), Python SDK (`fuzzload`), CLI commands, and HTTP/WS API reference |
| [Setup](docs/SETUP.md) | Local dev onboarding, env var matrix, verification suite, and troubleshooting |
| [Deploy](docs/DEPLOY.md) | Production topology, security headers, smoke checks, rollback, and incident runbooks |
| [Benchmarks](bench/README.md) | Verified Go hot-path microbenchmarks and 5-policy comparative latency tables |
| [Contributing](CONTRIBUTING.md) | Branching, emoji commit style, and PR checklist |
| [Changelog](CHANGELOG.md) | Release history mapped to commit history |
| [Security](SECURITY.md) | Vulnerability reporting policy and security scope |

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
