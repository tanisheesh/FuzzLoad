# Local Setup — FuzzLoad

> **Just want to try it?** Use the live deployment at [https://fuzzload.tanisheesh.in](https://fuzzload.tanisheesh.in) — zero setup needed.
> This guide covers running **FuzzLoad** locally, executing the full Go/Python/Next.js verification suite, and troubleshooting common local issues.

---

## Prerequisites & Versions

- **Node.js 22.x** and **pnpm 10+** (for `frontend/` Next.js 16 observability dashboard)
- **Python 3.12+** and `pip` (for `backend/` 5-Layer ANFIS + GP Control Plane, SDK & CLI)
- **Go 1.23+** *(optional for native Go SDK/proxy execution; Docker builds it automatically if omitted)*
- **Docker & Docker Compose** *(optional, for full multi-container cluster mode)*

---

## 1. Clone & Install

```bash
git clone https://github.com/tanisheesh/FuzzLoad
cd FuzzLoad

# Backend (Python AI Control Plane + `fuzzload` CLI/SDK)
cd backend && pip install -e ".[dev]" && cd ..

# Frontend (Next.js 16 Dashboard)
cd frontend && pnpm install --frozen-lockfile && cd ..
```

---

## 2. Environment Variables

Copy `.env.example` to `.env` in the repo root (and `frontend/.env.local` if customizing the API URL):

```bash
cp .env.example .env
```

| Variable | Type / Format | Required | Scope | Local Default / Source |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Origin URL | ❌ | Public | `http://localhost:8000` |
| `PORT` | Integer port | ❌ | Server-only | `8000` |
| `CORS_ORIGINS` | Comma-separated origins | ❌ | Server-only | `http://localhost:3000,https://fuzzload.tanisheesh.in` |
| `GO_PROXY_URL` | Origin URL | ❌ | Server-only | `http://127.0.0.1:8080` |
| `GO_PROXY_PORT` | Integer port | ❌ | Server-only | `8080` |
| `ANFIS_LEARNING_RATE` | Float (`0.001–0.1`) | ❌ | Server-only | `0.015` |
| `GP_POPULATION_SIZE` | Integer (`12–100`) | ❌ | Server-only | `36` |
| `GP_BLENDING_LAMBDA` | Float (`0.0–1.0`) | ❌ | Server-only | `0.58` |

> Never commit `.env` or `.env.local`, and never expose server secrets with `NEXT_PUBLIC_`.

---

## 3. Run Locally

### Mode A: Full Multi-Container Cluster (Docker Compose)

```bash
docker compose up --build
```

- **Dashboard UI:** `http://localhost:3000`
- **Python AI Control Plane API:** `http://localhost:8000/api/health`
- **Go Data Plane Proxy & Prometheus Metrics:** `http://localhost:8080/healthz` · `http://localhost:8080/metrics`

### Mode B: Fast Local Dev (No Docker Required)

```bash
# Terminal 1 — Go Data Plane Proxy + 4 Heterogeneous Workers (optional)
cd proxy-go && go run ./cmd/fuzzload-proxy --port 8080 --spawn-workers=true --loadgen-rps=120

# Terminal 2 — Python AI Control Plane
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 3 — Next.js 16 Dashboard
cd frontend && pnpm run dev
```

---

## 4. Run Verification & Full Test Suite

Run the exact same checks CI enforces before committing:

```bash
# Go SDK & Proxy (vet + race tests + zero-alloc microbenchmark + build)
cd proxy-go && go vet ./... && go test -v -race ./... && go test -run=^$ -bench=. -benchmem ./pkg/fuzzload && go build ./...

# Python Backend (compile + ruff + pytest)
cd backend && python -m compileall -q app fuzzload && ruff check . && python -m pytest -v

# Next.js Frontend (typecheck + production build)
cd frontend && pnpm run typecheck && pnpm run build

# Reproducible 5-policy benchmark
python bench/run_benchmark.py
```

*(If `coderabbit` CLI is installed: `coderabbit review --agent --uncommitted`)*

---

## 5. Known Local-Only Limitations

- Security headers defined in `frontend/vercel.json` apply at the Vercel edge in production, not under `next dev`.
- Without Docker, Linux cgroup CPU quotas are emulated by the calibrated worker queueing model; use `docker compose up` for container isolation.

---

## 6. Troubleshooting

| Symptom / Exact Error | Root Cause | Fix |
|---|---|---|
| `go_proxy_connected: false` in `/api/health` | Go proxy (`:8080`) not running | Start `go run ./cmd/fuzzload-proxy` or rely on automatic Digital Twin fallback |
| `400 Blocked unsafe or private probe URL` on `/api/probe` | SSRF protection blocks `localhost`, `127.0.0.1`, RFC1918 & metadata IPs | Probe public `https://` URLs (e.g. `https://httpbin.org/get`) |
| `Cannot find module 'recharts'` on `next build` | Stale `frontend/node_modules` after branch switch | Run `cd frontend && pnpm install --frozen-lockfile` |
| `port 8000 or 8080 already in use` | Existing proxy/API process bound to port | Pass `--port 8001` to `fuzzload start` or `--port 8081` to `fuzzload-proxy` |

---

## 7. Deploy to Production

See [DEPLOY.md](DEPLOY.md) for Vercel, Render, and AWS EC2 production setup, post-deploy smoke checks, and rollback procedures.

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
