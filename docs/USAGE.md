# Using FuzzLoad (Go SDK, Python SDK, CLI & HTTP API)

Complete reference for installing, embedding, and operating **FuzzLoad** across Go services, Python apps, CLI workflows, and REST/WebSocket integrations.

---

## 1. Installation & Entrypoints

```bash
# Go SDK (lock-free atomic router + standalone Neuro-Fuzzy/GP loop)
go get github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload@v1.0.0

# Go Reverse Proxy CLI binary
go install github.com/tanisheesh/FuzzLoad/proxy-go/cmd/fuzzload-proxy@v1.0.0

# Python SDK & CLI (from repo)
pip install -e ./backend
```

- **Live Web Console:** `https://fuzzload.tanisheesh.in`
- **Go Package Docs:** `https://pkg.go.dev/github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload@v1.0.0`
- **Default Control Plane URL:** `http://127.0.0.1:8000`
- **Default Go Data Plane URL:** `http://127.0.0.1:8080`

---

## 2. Authentication

FuzzLoad is designed as an internal cluster reverse proxy and control plane:
- Data-plane endpoints (`/*`, `/healthz`, `/metrics`) and local control endpoints (`/api/state`, `/api/telemetry`) do not require bearer auth by default.
- In production deployments, bind control ports (`:8000`, `/api/weights`, `/api/chaos`) to private VPC/loopback interfaces and restrict `CORS_ORIGINS` to trusted dashboard origins.

---

## 3. Go SDK Reference (`proxy-go/pkg/fuzzload`)

| Symbol / Method | Inputs | Behavior & Performance |
|---|---|---|
| `fuzzload.NewProxy(cfg)` | `Config{Algorithm, Upstreams, Health}` | Builds an atomic Copy-on-Write routing table (`*Proxy` implements `http.Handler`). |
| `proxy.SelectUpstream()` | None | Picks next healthy node in **~4.8–7.5 ns/op, 0 B/op, 0 allocs/op** (lock-free `atomic.Pointer`). |
| `proxy.StartAutoControlLoop(ctx, cfg)` | `AdaptiveConfig` (`Interval`, `SLATargetMs`, `BlendingLambda`, `EMAAlpha`) | Runs standalone pure-Go Gaussian Neuro-Fuzzy + symbolic GP weight optimization every `500ms`. |
| `proxy.StartHealthProber(ctx)` | `context.Context` | Background `/healthz` prober with automatic circuit-breaker tripping and cooldown recovery. |
| `proxy.UpdateWeights(algo, weights)` | `string`, `map[string]float64` | Atomically swaps routing policy and node probabilities with zero hot-path blocking. |
| `proxy.ControlMux()` | None | Returns combined `http.Handler` serving proxy traffic + `/healthz`, `/metrics`, `/api/telemetry`, `/api/weights`, `/api/chaos`. |

### Standalone Go SDK Example

```go
package main

import (
	"context"
	"log"
	"net/http"

	"github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload"
)

func main() {
	proxy, err := fuzzload.NewProxy(fuzzload.Config{
		Algorithm: fuzzload.AlgoFuzzLoad,
		Upstreams: []fuzzload.UpstreamSpec{
			{ID: "worker-a", URL: "http://10.0.1.11:8080", CapacityCores: 4},
			{ID: "worker-b", URL: "http://10.0.1.12:8080", CapacityCores: 2},
			{ID: "worker-c", URL: "http://10.0.1.13:8080", CapacityCores: 1},
		},
		Health: fuzzload.DefaultHealthConfig(),
	})
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	proxy.StartHealthProber(ctx)
	proxy.StartAutoControlLoop(ctx, fuzzload.DefaultAdaptiveConfig())

	log.Fatal(http.ListenAndServe(":8080", proxy.ControlMux()))
}
```

---

## 4. Python SDK & CLI Reference (`backend/`)

### CLI Commands

| Command | Flags | Defaults & Constraints | Output |
|---|---|---|---|
| `fuzzload start` | `--upstreams`, `--weights`, `--policy`, `--config`, `--go-proxy-url`, `--port` | `--policy fuzzload`, `--port 8000` | Starts FastAPI 5-layer ANFIS + GP control plane |
| `fuzzload probe` | `--urls` (required), `--requests`, `--timeout` | `--requests 3`, `--timeout 5.0` | Live ASCII table of P50/P95 latencies, ANFIS/GP scores & share % |
| `fuzzload bench` | `--format` (`markdown` \| `json`) | `--format markdown` | Comparative 5-policy benchmark table |
| `fuzzload-proxy` (Go) | `--port`, `--upstreams`, `--weights`, `--policy`, `--config`, `--spawn-workers`, `--standalone-auto`, `--loadgen-rps` | `--port 8080`, `--spawn-workers=true` | Starts Go L7 reverse proxy + Prometheus `/metrics` |

### Python SDK Example

```python
from fuzzload import FuzzLoadRouter

router = FuzzLoadRouter(
    upstreams=[
        {"id": "worker-a", "url": "http://10.0.1.11:8080", "cores": 4.0},
        {"id": "worker-b", "url": "http://10.0.1.12:8080", "cores": 2.0},
    ],
    blending_lambda=0.58,
    sla_target_ms=85.0,
)

# Zero-overhead probabilistic upstream pick
target_url = router.select_upstream()

# Record observed metrics and run 1 online ANFIS backpropagation step
updated_weights = router.record_telemetry(
    "worker-a", latency_ms=18.4, cpu=0.31, mem=0.28, active_conns=12
)

# Or forward an HTTP request + auto-update weights in one call
result = router.forward_request("/health", method="GET", timeout_sec=5.0)
```

---

## 5. HTTP & WebSocket API Contracts

| Plane | Method & Route | Payload / Query | Response |
|---|---|---|---|
| Control (`:8000`) | `GET /api/health` | — | `200 JSON` (`status`, `algorithm`, `anfis_epoch`, `gp_generation`, `go_proxy_connected`) |
| Control (`:8000`) | `GET /api/state` | — | `200 JSON` full cluster, ANFIS curves, GP AST, ART/BAM & benchmark snapshot |
| Control (`:8000`) | `POST /api/config/algorithm` | `{"algorithm": "fuzzload"}` | `200 JSON` updated state (`400` on invalid policy) |
| Control (`:8000`) | `POST /api/config/traffic` | `{"profile": "flash_crowd", "base_rps": 600}` | `200 JSON` (`base_rps` bounded `60..1500`) |
| Control (`:8000`) | `POST /api/chaos/inject` | `{"node_id": "node-2", "fault_type": "cpu_spike", "enabled": true}` | `200 JSON` + syncs fault to Go worker |
| Control (`:8000`) | `POST /api/gp/evolve` | `{"generations": 5}` | `200 JSON` (`generations` bounded `1..20`) |
| Control (`:8000`) | `POST /api/proxy/probe` | `{"requestsPerTarget": 3, "targets": [...]}` | `200 JSON` (`400` on private/SSRF URLs; max 8 targets, 10 reqs/target) |
| Control (`:8000`) | `WS /ws/telemetry` | — | `2 Hz` JSON state stream |
| Data (`:8080`) | `GET /api/telemetry` | — | `200 JSON` per-node live ring-buffer P50/P95/P99 & circuit-breaker state |
| Data (`:8080`) | `POST /api/weights` | `{"algorithm": "fuzzload", "weights": {"node-1": 0.5}}` | `200 JSON` atomic table swap |
| Data (`:8080`) | `GET /metrics` | — | `200 text/plain` Prometheus exposition format |

---

## 6. Error Reference

| Status / Exit | Meaning | How to Fix |
|---|---|---|
| `400 Bad Request` | Invalid algorithm name, unknown `node_id`, or blocked private/SSRF URL | Verify valid enum values and use public `http(s)://` URLs for `/api/probe` |
| `422 Unprocessable Entity` | Pydantic schema constraint violated (`base_rps` outside `60..1500`, `generations` outside `1..20`) | Pass values within documented bounds |
| `502 Bad Gateway` | Selected upstream failed or timed out; passive circuit breaker increments consecutive failures | Check upstream `/healthz`; FuzzLoad automatically drains traffic after 3 failures |

---

## 7. Configuration Reference

| Env Var | Default | Description |
|---|---|---|
| `GO_PROXY_URL` | `http://127.0.0.1:8080` | Go Data Plane base URL polled by Python Control Plane |
| `GO_PROXY_PORT` | `8080` | Listening port for `fuzzload-proxy` |
| `CORS_ORIGINS` | `http://localhost:3000,https://fuzzload.tanisheesh.in` | Comma-separated allowed CORS origins for FastAPI |
| `FUZZLOAD_POLICY` | `fuzzload` | Initial routing policy (`fuzzload`, `anfis_only`, `weighted_round_robin`, `least_connections`, `round_robin`) |
| `FUZZLOAD_UPSTREAMS` | *(4-node cluster)* | Optional comma-separated upstream URLs loaded on boot |
| `ANFIS_LEARNING_RATE` | `0.015` | Online backpropagation step size for 5-layer ANFIS |
| `GP_POPULATION_SIZE` | `36` | Number of symbolic trees evolved per GP generation |
| `GP_BLENDING_LAMBDA` | `0.58` | Weight assigned to ANFIS vs. GP symbolic score |

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
