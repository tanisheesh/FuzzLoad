# FuzzLoad — Product Requirements Document

**Status:** Final  
**Owners:** Tanish Poddar & Krish (`krish-codess`)  
**One-liner:** Adaptive Web Server Load Balancing Using Genetic Programming and Neuro-Fuzzy Control.

---

## 1. Problem

Static reverse-proxy load balancers (Nginx, HAProxy, AWS ALB) route traffic using fixed heuristics such as Round Robin, Least Connections, or static Weighted Round Robin. In real-world microservice clusters with heterogeneous server hardware, noisy-neighbor resource contention, and sudden flash-crowd traffic bursts, single-metric heuristics fail to capture non-linear bottlenecks (such as high I/O wait with low CPU utilization). As a result, static policies continue routing requests to degraded nodes, causing severe P95 and P99 tail-latency spikes and cascading timeouts.

---

## 2. Goals (v1 / MVP)

1. **Dual-Loop Soft-Computing Control Plane:** Implement a 5-layer Adaptive Neuro-Fuzzy Inference System (ANFIS) updating server routing weights every 500ms via online gradient descent, paired with a Genetic Programming (GP) symbolic regression engine evolving non-linear heuristic formulas every 5–10 seconds.
2. **High-Throughput Go Reverse Proxy & Cluster:** Provide a lock-free Go reverse proxy (`httputil.ReverseProxy`) and heterogeneous worker cluster capable of switching live between 5 routing algorithms (`Round Robin`, `Least Connections`, `Weighted Round Robin`, `ANFIS-Only`, and `FuzzLoad GP+ANFIS`).
3. **Digital Twin Replay Simulator:** Evaluate mutated GP expression trees against a rolling 60-second telemetry replay buffer so unsafe candidate policies never impact live user traffic.
4. **Interactive Chaos & Observability Dashboard:** Deliver a real-time Next.js dashboard displaying live server topology, Gaussian fuzzy membership curves, ANFIS layer weights, evolved GP syntax trees, and comparative P50/P95/P99 latency charts with one-click chaos fault injection.

---

## 3. Non-Goals (explicit scope cuts)

- **Layer-4 TCP/UDP Packet Forwarding in Kernel Space (eBPF/XDP)** — Deferred to v2; Layer-7 HTTP/HTTPS reverse proxying in Go is sufficient to prove the ANFIS + GP control loop and inspect application-level latency.
- **Automated Horizontal Auto-Scaling (Kubernetes HPA)** — FuzzLoad focuses on optimal traffic distribution across an existing heterogeneous server pool rather than provisioning new VM instances.
- **Multi-Region Geo-DNS Routing** — Out of scope for v1; optimization targets intra-cluster backend selection.

---

## 4. Users

**Primary:** Distributed systems engineers, researchers, and academic evaluators benchmarking adaptive soft-computing load-balancing policies against classical heuristics under bursty and degraded cluster conditions.

**Secondary:** Technical recruiters and interviewers evaluating systems + AI engineering capabilities through an interactive, self-contained live cluster simulation at `fuzzload.tanisheesh.in`.

---

## 5. User Stories

1. *As a systems engineer,* I can switch the active routing algorithm between `Round Robin`, `Least Connections`, `Weighted Round Robin`, `ANFIS-Only`, and `FuzzLoad (GP + ANFIS)` in real time so that I can observe immediate P95/P99 tail-latency differences.
2. *As a researcher,* I can inspect the live 5-layer ANFIS Gaussian membership curves ($\mu_{\text{Low}}, \mu_{\text{Medium}}, \mu_{\text{High}}$) and online backpropagation loss so that I can verify how fuzzy rules adapt to server degradation.
3. *As a researcher,* I can view the mathematical expression tree evolved by Genetic Programming across generations alongside its fitness score so that the routing policy remains interpretable and auditable.
4. *As a chaos engineer,* I can inject synthetic CPU spikes, memory leaks, or I/O latency jitter into any backend worker node with one click so that I can test how quickly FuzzLoad drains traffic away from degraded servers.
5. *As an evaluator,* I can run an automated multi-algorithm benchmark suite that tests all 5 routing policies against identical traffic profiles and produces side-by-side P50/P95/P99 latency, throughput, and Jain's Fairness Index metrics.

---

## 6. Functional Requirements

### 6.1 Data Plane Reverse Proxy (Go & Async Runtime)

- Maintain an atomic, lock-free routing weight table updated by the AI Control Plane without dropping in-flight HTTP requests.
- Support 5 selectable routing policies: `round_robin`, `least_connections`, `weighted_round_robin`, `anfis_only`, and `fuzzload` (hybrid ANFIS + GP).
- Record per-request response latency, HTTP status code, and active connection counts per backend node in a rolling sliding window.

### 6.2 Neuro-Fuzzy (ANFIS) Fast Control Loop

- Collect normalized telemetry vectors `[CPU, MEM, LAT, CONN, ERR]` for every backend server every `500ms`.
- Perform forward inference through 5 layers: Gaussian Fuzzification, Product T-Norm Rule Firing, Normalization, Takagi-Sugeno Linear Consequents, and Defuzzified Output Score.
- Execute an online gradient descent step on premise parameters ($c, \sigma$) and consequent weights ($p, q, r, s, b$) whenever observed server latency deviates from the target SLA.

### 6.3 Genetic Programming (GP) Slow Control Loop

- Maintain a population of symbolic expression trees composed of server telemetry terminals and mathematical primitives (`+`, `-`, `*`, `protected_div`, `min`, `max`, `exp`, `sqrt`).
- Run tournament selection, subtree crossover, and point mutation every 5–10 seconds against the 60-second Digital Twin telemetry replay buffer.
- Promote the highest-fitness individual into the hybrid routing controller only when its simulated fitness exceeds the baseline heuristic.

### 6.4 Live Observability & Chaos Dashboard

- Stream real-time cluster state, routing weights, ANFIS membership parameters, and GP evolution events over WebSockets/polling at `2 Hz`.
- Provide interactive traffic pattern controls (`Steady`, `Sine Wave`, `Flash Crowd Spike`, `Chaos Burst`) and per-node fault injection (`CPU Spike`, `Memory Pressure`, `Network Lag`, `Node Offline`).

---

## 7. Non-Functional Requirements

- **Routing Overhead:** Data-plane target selection must execute in `< 0.2ms` per request using pre-computed weights.
- **Memory Footprint:** Total backend footprint (Go Proxy + 4 Worker Nodes + Python AI Control Plane) must stay under `350 MB RAM` so it runs reliably on AWS EC2 Free Tier (`t2.micro`/`t3.micro`) and Render Free Tier.
- **Numerical Stability:** All GP operators (`protected_div`, `protected_exp`, `protected_sqrt`) and ANFIS Gaussian denominators must guard against `NaN`/`Inf` division-by-zero conditions, falling back to safe uniform weights if an anomaly occurs.
- **Security:** Control-plane weight mutation and chaos injection endpoints validate input bounds with Pydantic schemas and rate limits.

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| P95 Tail Latency Reduction | `>= 30%` lower P95 latency than Round Robin under heterogeneous chaos load |
| ANFIS Convergence Speed | Drains traffic weight (`< 0.08`) from a CPU-spiked node within `1.5 seconds` (3 fast-loop ticks) |
| Jain's Fairness Index (Capacity-Normalized) | `>= 0.92` across heterogeneous worker nodes |
| Live Dashboard Responsiveness | `< 100ms` UI update latency with smooth 60fps charts |

---

## 9. Risks & Open Questions

- **Weight Oscillation (Herd Effect):** If all requests suddenly shift to the single lowest-latency node, that node can overload on the next tick. *Mitigated by exponential moving average (EMA) weight smoothing ($\alpha = 0.35$) and stochastic proportional routing.*
- **GP Expression Bloat:** Genetic Programming trees can grow arbitrarily deep over generations without improving fitness. *Mitigated by enforcing a strict parsimony pressure penalty and a max tree depth of `5`.*

---

## 10. v2 Candidates

- **eBPF/XDP Kernel Data Plane** — Push the ANFIS+GP weights directly into a Linux eBPF map for line-rate L4 packet forwarding.
- **Type-2 Interval Fuzzy Logic** — Upgrade from Type-1 Gaussian membership functions to Interval Type-2 Fuzzy Sets to model higher-order telemetry jitter in multi-cloud environments.
- **gRPC Streaming Telemetry Protocol** — Replace HTTP/JSON control-plane polling with bidirectional gRPC protobuf streams.

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
