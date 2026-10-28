# Engineering Decisions — FuzzLoad

---

## Decision 1 — Decoupling the Go Data Plane from the Python AI Control Plane

**Context:** An adaptive load balancer must route thousands of HTTP requests per second with sub-millisecond overhead while simultaneously running neural network gradient descent (ANFIS) and evolutionary symbolic regression (Genetic Programming).

**Decision:** Split the system into a lock-free **Go Reverse Proxy Data Plane** (handling HTTP forwarding and atomic weight lookups) and an asynchronous **Python AI Control Plane** (computing ANFIS + GP weights out-of-band).

**Reason:** Running neural network inference or genetic tree evaluation synchronously inside an HTTP request handler would add `5ms–50ms` of latency to every request, defeating the purpose of a load balancer. By decoupling them, request routing reads an atomic weight array in `<0.2ms`, while ANFIS updates weights every `500ms` and GP evolves formulas every `6s`.

**Tradeoff:** Routing weights are eventually consistent by up to `500ms` rather than updated per-packet, which is an acceptable tradeoff given that server CPU/memory metrics also update on sub-second intervals.

---

## Decision 2 — Combining Neuro-Fuzzy (ANFIS) + Genetic Programming over Deep Reinforcement Learning (DRL)

**Context:** We needed an intelligent control mechanism that adapts to heterogeneous server capacities and non-linear bottlenecks (such as high I/O wait with low CPU usage).

**Decision:** Use a hybrid **5-Layer Takagi-Sugeno ANFIS** controller for fast online parameter adaptation paired with **Tree-Based Genetic Programming (GP)** for symbolic heuristic discovery, instead of Deep Reinforcement Learning (PPO/DQN).

**Reason:** Deep RL models require hundreds of thousands of training episodes, suffer from catastrophic forgetting during unseen flash-crowd spikes, and act as black boxes that cannot be explained during a system outage or academic viva. ANFIS encodes domain knowledge via interpretable fuzzy membership curves (`Low`, `Medium`, `High`) and trains smoothly via gradient descent, while GP evolves explicit mathematical formulas (e.g., `(1 - CPU^2) / (0.2 + LAT * CONN)`) that engineers can inspect directly.

**Tradeoff:** Maintaining two cooperative loops (fast gradient loop + slow evolutionary loop) requires careful hyperparameter balancing ($\lambda$ blending factor) compared to a single end-to-end neural network.

---

## Decision 3 — Evaluating GP Individuals on a 60s Digital Twin Replay Buffer

**Context:** Genetic Programming mutates and crosses over random mathematical trees; many candidate formulas in early generations produce poor routing weights.

**Decision:** Evaluate all GP population individuals offline against a rolling 60-second **Digital Twin Telemetry Replay Buffer** rather than testing candidate formulas on live traffic.

**Reason:** Applying a poorly mutated formula to live traffic would immediately route requests to overloaded servers and cause production 502/504 errors. Simulating 40 individuals across 15 generations on recorded request traces takes `<40ms` in vectorized NumPy and guarantees that only elite, verified formulas are promoted to the live control plane.

**Tradeoff:** The replay simulator is a first-order queueing approximation of the cluster rather than a cycle-accurate hardware emulator, which ANFIS compensates for in the fast loop via online backpropagation on real latency.

---

## Decision 4 — Dual-Mode Multi-Stage Deployment (AWS EC2 Docker Compose + Render Single-Container)

**Context:** Running a distributed cluster (Proxy + AI Control Plane + 4 Backend Worker Nodes) in the cloud typically requires paying for 6 separate compute instances.

**Decision:** Architect the backend so it can run both as a **6-container `docker-compose.yml` cluster** (for AWS EC2 Free Tier or local demos) and as a **single unified container** (for Render Free Tier) where the Go binary and Python control plane run side-by-side.

**Reason:** Go worker nodes and the Go proxy consume less than `20MB RAM` combined. Packaging the Go binary and Python FastAPI service into a multi-stage `Dockerfile` allows the entire live demo to run 24/7 at `$0/month` on free cloud tiers while still supporting true multi-container cgroup isolation on AWS EC2 or Docker Desktop.

**Tradeoff:** In single-container cloud mode, worker CPU contention is simulated via calibrated service-time queueing models alongside real goroutine workers rather than separate physical VMs.

---

## What I'd do differently in v2

- **eBPF/XDP Kernel Bypass** — Move the HTTP/TCP forwarding plane into a Linux eBPF program that reads server weights from a shared BPF map updated by the Python ANFIS+GP daemon, eliminating userspace socket copy overhead.
- **Interval Type-2 Fuzzy Sets** — Upgrade the ANFIS fuzzification layer from Type-1 Gaussian curves to Interval Type-2 Fuzzy Logic with a Footprint of Uncertainty (FOU) to better handle noisy cloud network jitter.
- **Predictive Time-Series Forecaster** — Feed a lightweight temporal convolutional filter into ANFIS so weights shift proactively based on the derivative of incoming request rate ($\frac{d(\text{RPS})}{dt}$) before queues build up.

---

## Explicit non-decisions (deferred to v2)

| Feature | Why deferred |
|---|---|
| Persistent TimescaleDB telemetry history | In-memory ring buffers keep latency under `0.1ms` and keep cloud hosting 100% free |
| Multi-region Geo-DNS load balancing | Intra-cluster L7 load balancing is the core focus of the ANFIS + GP control algorithm |

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
