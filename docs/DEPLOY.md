# Deploying FuzzLoad

> **Live:** [https://fuzzload.tanisheesh.in](https://fuzzload.tanisheesh.in) · **Host:** Vercel (Frontend) + Render / AWS EC2 Docker (Backend) · **Auto-deploy:** on push to `main`

For local development, see [SETUP.md](SETUP.md).

---

## 1. Production Topology & Resource Limits

| Component | Host / Service | Region & Runtime | Configured Limits / Quotas |
|---|---|---|---|
| **Frontend Dashboard (`frontend/`)** | Vercel (Free) | `bom1` (India) · Node `22.x` · Fluid Compute | `30s` timeout · sourcemaps protected · docs-only builds ignored |
| **Go Proxy + Python Control Plane** | Render (Free Docker) *or* AWS EC2 (`t3.micro`) | Multi-stage `golang:1.23-alpine` + `python:3.12-slim` | `512 MB` RAM on Render (sleeps after 15m idle; UI Digital Twin hides cold start) |
| **Go SDK Package** | Go Module Proxy (`pkg.go.dev`) | Public tag `proxy-go/v1.0.0` | Immutable Go checksum DB (`sum.golang.org`) |
| **DNS & TLS** | GoDaddy → Vercel | `fuzzload.tanisheesh.in` | CNAME + automatic Vercel TLS certificate |

---

## 2. Production Environment Variables

Configure variables in the host dashboard (encrypted at rest; never commit). Full list in [`.env.example`](../.env.example).

| Variable | Required | Host Location | Sensitivity |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ❌ (falls back to Digital Twin) | Vercel → Project → Environment Variables | Public origin URL |
| `PORT` | ❌ (default `8000`) | Render / Docker container | Low |
| `CORS_ORIGINS` | ❌ | Render / Docker (`https://fuzzload.tanisheesh.in`) | Medium (restricts cross-origin control API) |
| `GO_PROXY_URL` | ❌ (default `http://127.0.0.1:8080`) | Render / Docker | Internal loopback |
| `GO_LOADGEN_RPS` | ❌ (default `120`) | Multi-stage Docker entrypoint | Controls live Go socket traffic rate |

> Changing an env var does **not** update running deployments — trigger a redeploy after editing env vars.

---

## 3. First-Time Deploy

### Frontend (Vercel)

1. [vercel.com/new](https://vercel.com/new) → import `tanisheesh/FuzzLoad`.
2. Framework preset: **Next.js** · Root directory: `frontend`.
3. Apply production & security settings via `setup-toolkit`:
   ```powershell
   ..\setup-toolkit\scripts\setup-vercel-project.ps1 -Project "fuzzload" -RepoPath . -RootDirectory "frontend" -Region "bom1" -IgnoreDocsOnlyBuilds
   ```

### Backend Cluster — Render (Free Multi-Stage Docker) or AWS EC2

- **Render (`render.yaml`):** Connect `tanisheesh/FuzzLoad` → Docker runtime → root `./Dockerfile` → health check `/api/health`.
- **AWS EC2 / Self-Host Docker Compose:**
  ```bash
  git clone https://github.com/tanisheesh/FuzzLoad.git && cd FuzzLoad
  docker compose up -d --build
  ```

### Go SDK Release (`pkg.go.dev`)

```bash
git tag -a proxy-go/v1.0.0 -m "FuzzLoad Go SDK v1.0.0"
git push origin proxy-go/v1.0.0
```

---

## 4. Custom Domain & Security Headers

`fuzzload.tanisheesh.in` is wired via:

```powershell
..\setup-toolkit\scripts\setup-subdomain.ps1 -Subdomain "fuzzload" -Platform Vercel -VercelProject "fuzzload"
```

- **Security Headers (`frontend/vercel.json`):** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

---

## 5. Post-Deploy Smoke Verification

```bash
# 1. Verify production site returns HTTP 200 and active security headers
curl -sI https://fuzzload.tanisheesh.in | grep -iE "HTTP/|x-frame-options|x-content-type-options|strict-transport-security|referrer-policy|permissions-policy"

# 2. Verify SSRF guard blocks loopback probe targets on /api/probe
curl -s -X POST https://fuzzload.tanisheesh.in/api/probe \
  -H "Content-Type: application/json" \
  -d '{"requestsPerTarget":1,"targets":[{"id":"t1","name":"local","url":"http://127.0.0.1:8000","cores":2}]}'

# 3. Verify Go SDK package is indexed on pkg.go.dev
curl -fsSI https://pkg.go.dev/github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload@v1.0.0
```

- [ ] `https://fuzzload.tanisheesh.in`, `/dashboard`, `/playground`, and `/how-it-works` load cleanly on mobile (`375px`) and desktop (`1280px`) with zero console errors.
- [ ] Injecting a fault on `/dashboard` drains node share within `1.5s`.

---

## 6. Rollback Procedure

| Layer | Rollback Action |
|---|---|
| **Vercel** | Dashboard → Deployments → pick last known good deploy → **Promote to Production** |
| **Render** | Service → Events → last good deploy → **Rollback** |
| **AWS EC2** | `git checkout <last-good-sha> && docker compose up -d --build` |

Record any manual rollback (target SHA + reason) in a commit or PR so the next push to `main` does not silently re-ship the broken build.

---

## 7. Incident Runbooks

| Incident | Immediate Action |
|---|---|
| **Backend container sleeping / unreachable** | Dashboard automatically switches to client Digital Twin (`500ms`); check Render logs and `/api/health` |
| **Go proxy upstream 5xx storm** | Passive circuit breaker isolates failing nodes after 3 consecutive errors; inspect `/metrics` (`fuzzload_node_circuit_open`) |
| **Suspected secret leak** | Rotate token immediately → update GitHub/Vercel env vars → verify Gitleaks + GitHub Secret Scanning clear |

---

## 8. Monitoring & Automated Maintenance

- **Logs:** Vercel Project Logs · Render Service Logs · Go Prometheus `/metrics`
- **Automated Hygiene:** CI (`ci.yml`), CodeQL (`codeql.yml`), Gitleaks (`secret-scan.yml`), Dependency Review (`dependency-review.yml`), Renovate (`Yantra [bot]`), and Monday 10:00 IST Maintenance Report (`maintenance-report.yml`).

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
