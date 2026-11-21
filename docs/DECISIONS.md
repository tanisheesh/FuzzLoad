# Engineering Decisions — FuzzLoad

---

## ADR-01 — Decoupling the Lock-Free Go Data Plane from the Python AI Control Plane

**Context:** An adaptive load balancer must route thousands of HTTP requests per second with sub-millisecond overhead while simultaneously running neural-fuzzy online backpropagation (ANFIS) and evolutionary tree search (Genetic Programming).

### Options Considered

| Option | Routing Overhead | Memory Footprint | Ops Complexity | Verdict |
|---|---|---|---|---|
| **Go `atomic.Pointer` Data Plane + Python Async Control Plane** | `4.8–7.5 ns/op` (`0 allocs/op`) | `~15 MB` Go + `~160 MB` Python | Medium (unified single Dockerfile) | ✅ **Chosen** |
| All-Python Async Proxy (`FastAPI` + `httpx`) | `2–12 ms` (GIL & GC jitter) | `~180 MB` | Low | ❌ Rejected |
| Rust (`Axum`/`Tokio`) + Python | `< 10 ns/op` | `~10 MB` | High (longer CI build times) | ❌ Rejected |

**Decision & Reason:** Split the system into a lock-free Go Reverse Proxy & SDK (`proxy-go/pkg/fuzzload`) handling HTTP forwarding via Copy-on-Write `atomic.Pointer` snapshots and a `[128]atomic.Uint64` latency ring buffer, paired with an out-of-band Python Control Plane (`backend/`) updating weights every `500ms`. Adding a standalone pure-Go adaptive loop (`StartAutoControlLoop`) also lets Go users embed `pkg/fuzzload` with zero Python dependency.

**Tradeoff Accepted:** Weight updates from the Python Control Plane are eventually consistent by up to `500ms` rather than computed synchronously per request.

**Reversal Trigger:** Revisit when single-host traffic exceeds `100,000 RPS` and userspace Go `net/http` socket copy overhead dominates CPU — migrate the L4 forwarding loop to eBPF/XDP reading pinned BPF weight maps.

---

## ADR-02 — Hybrid Neuro-Fuzzy (ANFIS) + Symbolic Genetic Programming over Deep RL

**Context:** Heterogeneous clusters exhibit non-linear bottlenecks (such as I/O wait stalls where CPU remains low while P95 latency spikes) that single-metric heuristics miss, yet routing decisions must stay auditable and safe on unseen traffic bursts.

### Options Considered

| Option | Convergence Speed | Explainability | Cold-Start Safety | Verdict |
|---|---|---|---|---|
| **5-Layer Takagi-Sugeno ANFIS + Symbolic GP + ART/BAM** | `~1.5s` (3 fast ticks) | High (Gaussian curves + explicit math AST) | High (expert rules work at epoch 0) | ✅ **Chosen** |
| Deep Reinforcement Learning (PPO / DQN) | `10^4+` episodes | Black box | Poor (unsafe exploration on spikes) | ❌ Rejected |
| Static Weighted Round Robin / Least Connections | Instant | High | Medium (fails under I/O stalls) | ❌ Rejected |

**Decision & Reason:** Fuzzy membership curves eliminate threshold flapping around crisp cutoffs, 5-layer ANFIS adapts premise/consequent parameters smoothly via momentum backpropagation, and Genetic Programming evolves explicit, inspectable formulas (`(1 - CPU^2) / (0.25 + LAT * (1 + CONN))`) rather than opaque neural weights.

**Tradeoff Accepted:** Requires balancing two cooperative timescales (`500ms` fast loop vs `6s` slow loop) via blending hyperparameter `lambda = 0.58`.

**Reversal Trigger:** Revisit if telemetry expands beyond 12+ high-dimensional kernel counters (e.g. L3 cache misses, NIC ring drops) where rule-base combinatorial growth makes Type-1 ANFIS impractical — upgrade to Interval Type-2 Fuzzy Sets or a compact neural residual scorer.

---

## ADR-03 — Evaluating Genetic Programming Trees on a 60s Digital Twin Replay Buffer

**Context:** Genetic Programming mutates and crosses over mathematical syntax trees; evaluating low-fitness or unstable candidate expressions on live production traffic would route requests into overloaded servers.

### Options Considered

| Option | Live Traffic Risk | Eval Latency (36 trees × 2 gens) | Fidelity | Verdict |
|---|---|---|---|---|
| **60-Second Digital Twin Telemetry Replay Buffer** | Zero | `< 40 ms` | High (calibrated queueing + real trace) | ✅ **Chosen** |
| Online Canary Evaluation on Live Traffic | High (502/504 spikes) | Seconds–Minutes | Exact | ❌ Rejected |
| Offline Static Training Only | Zero | `0 ms` runtime | Stale on workload shifts | ❌ Rejected |

**Decision & Reason:** Every GP generation is scored offline against the last `120` recorded ticks (`60s`) with protected operators (`protected_div`, `protected_exp`, `protected_sqrt`) and parsimony pressure (`max_depth = 4`). Only verified elite formulas and 12-bit FLC-GA rule masks are promoted into live routing.

**Tradeoff Accepted:** The replay simulator is a first-order queueing approximation rather than a cycle-accurate hardware emulator; the `500ms` ANFIS fast loop compensates online using real observed latencies.

**Reversal Trigger:** Revisit if workload regimes shift faster than `60s` windows (e.g. sub-second DDoS bursts) — shrink replay horizon or add a real-time derivative (`d(RPS)/dt`) forecaster.

---

## ADR-04 — Dual-Mode Cloud Deployment (Unified Container + Client Digital Twin Fallback)

**Context:** Running a Go proxy, 4 worker nodes, Python AI control plane, and Next.js UI normally requires 6 paid cloud instances.

### Options Considered

| Option | Monthly Cost | Cold-Start UX | Cluster Isolation | Verdict |
|---|---|---|---|---|
| **Vercel Frontend (with Digital Twin fallback) + Multi-Stage Docker / Compose** | `$0/mo` | Instant (`< 100ms` UI load) | Multi-container locally / unified on Render | ✅ **Chosen** |
| Managed Kubernetes (EKS / GKE) | `$75–$150/mo` | Instant | Full cgroup isolation | ❌ Rejected |

**Decision & Reason:** Compiling `fuzzload-proxy` into the Python container via a multi-stage `Dockerfile` runs the entire Go+Python stack under `~200 MB RAM` for `$0/mo`, while `docker-compose.yml` preserves multi-container local testing and the Next.js Digital Twin prevents blank screens during Render free-tier sleep.

**Tradeoff Accepted:** In single-container free-tier mode, worker CPU contention is calibrated mathematically alongside real Go HTTP goroutines rather than separate physical VMs.

**Reversal Trigger:** Move backend to an always-on AWS EC2 `t4g.small` or Fly.io machine when persistent 24/7 live backend traffic is required without cold starts.

---

## What I'd improve next

- **eBPF/XDP Kernel Bypass** — Eliminate userspace socket copies by pushing ANFIS+GP weights into pinned BPF maps.
- **Interval Type-2 Fuzzy Sets** — Add Footprint of Uncertainty (FOU) bounds to absorb high-variance multi-AZ cloud network jitter.
- **Playwright E2E + Axe Accessibility Suite** — Add automated browser smoke tests across all 4 dashboard routes at `375px` and `1280px`.

---

## Explicit Non-Decisions (Deferred)

| Feature | Why Deferred | Trigger to Build |
|---|---|---|
| Persistent TimescaleDB telemetry store | In-memory ring buffers keep hot path `< 10ns` and cloud hosting `$0/mo` | Multi-week historical SLA audit queries requested |
| Multi-region Geo-DNS routing | Intra-cluster L7 balancing is the core research & systems scope | Cross-region active-active deployment target |

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
