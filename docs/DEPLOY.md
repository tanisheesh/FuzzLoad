# Deploying FuzzLoad

> **Live:** [https://fuzzload.tanisheesh.in](https://fuzzload.tanisheesh.in) · **Host:** Vercel (Frontend) + AWS EC2 / Render (Backend Cluster) · **Auto-deploy:** on push to `main`

For local development, see [SETUP.md](SETUP.md).

---

## 1. Architecture in production

| Piece | Runs on | Notes |
|---|---|---|
| **Frontend Dashboard (`frontend/`)** | **Vercel (Free Tier)** | Next.js 16 App Router, served on `https://fuzzload.tanisheesh.in` |
| **Go Proxy + Python AI Control Plane** | **AWS EC2 (`t3.micro` Free Tier / `t4g.small`)** *or* **Render (Free Docker Service)** | Runs Go Reverse Proxy (`:8080`), 4 Heterogeneous Workers (`:9001-9004`), and FastAPI ANFIS+GP Control Plane (`:8000`) |
| **DNS** | **GoDaddy** | `fuzzload.tanisheesh.in` → CNAME to Vercel |

---

## 2. Environment variables

Set these in the host dashboard (never commit them). Names and defaults are in [`.env.example`](../.env.example).

| Variable | Required | Where it's set |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Vercel → Project → Settings → Environment Variables (points to AWS EC2 / Render backend URL) |
| `PORT` | ❌ | Render / AWS Docker container port (default `8000`) |
| `GO_PROXY_URL` | ❌ | Internal Go proxy endpoint (default `http://127.0.0.1:8080`) |
| `CORS_ORIGINS` | ❌ | Allowed frontend origins (`https://fuzzload.tanisheesh.in,http://localhost:3000`) |

> After changing an env var, **redeploy**. Running deployments don't pick up new values.

---

## 3. First-time deploy

### Step 1: Backend Cluster — Option A: AWS EC2 (Free Tier `t3.micro` / `t2.micro` or Minimal-Cost Spot `t4g.small`)

1. Launch an Ubuntu 24.04 LTS EC2 instance (`t3.micro` for $0/month on AWS Free Tier, or `t4g.small` for ~$3/month).
2. Allow inbound ports `80`, `443`, `8000` (AI Control Plane API), and `8080` (Go Reverse Proxy) in the AWS Security Group.
3. SSH into the instance and run:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
   git clone https://github.com/tanisheesh/FuzzLoad.git
   cd FuzzLoad
   sudo docker compose up -d --build
   ```
4. Verify with `curl http://<EC2_PUBLIC_IP>:8000/api/health`.

### Step 1: Backend Cluster — Option B: Render (100% Free Multi-Stage Docker Web Service)

1. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service** → connect `tanisheesh/FuzzLoad`.
2. Runtime: **Docker** · Dockerfile path: `./Dockerfile` (compiles the Go proxy + worker binary and runs it alongside the Python FastAPI ANFIS+GP Control Plane inside one container).
3. Plan: **Free** → Deploy. Copy the `https://fuzzload-api.onrender.com` URL.

### Step 2: Frontend Dashboard — Vercel (100% Free)

1. [vercel.com/new](https://vercel.com/new) → import `tanisheesh/FuzzLoad`.
2. Framework preset: **Next.js** · Root directory: `frontend`.
3. Set `NEXT_PUBLIC_API_URL` to your AWS EC2 or Render backend URL.
4. Deploy. Every push to `main` automatically deploys to production.

---

## 4. Custom domain

`fuzzload.tanisheesh.in` is wired with the setup toolkit:

```powershell
.\scripts\setup-subdomain.ps1 -Subdomain "fuzzload" -Platform Vercel -VercelProject "fuzzload"
```

Manual fallback: add `fuzzload.tanisheesh.in` in the Vercel project domains tab, then create a GoDaddy CNAME `fuzzload` → `cname.vercel-dns.com`. HTTPS certificates are issued automatically once DNS resolves (2–10 min).

---

## 5. Verify a deploy

- [ ] `https://fuzzload.tanisheesh.in` loads with live cluster topology and telemetry charts
- [ ] `GET /api/health` on the backend returns `{"status": "ok"}` with Go proxy + ANFIS + GP status
- [ ] Switching algorithms (`Round Robin` → `FuzzLoad GP+ANFIS`) immediately updates routing weights
- [ ] Clicking **Inject Chaos** on a node triggers ANFIS weight adaptation within 1.5 seconds

---

## 6. Rollback

| Host | How |
|---|---|
| Vercel | Dashboard → Deployments → pick the last good one → **Promote to Production** |
| Render | Service → Events → last good deploy → **Rollback** |
| AWS EC2 | `git checkout <last-good-commit> && sudo docker compose up -d --build` |

After rolling back, note it in a commit or PR so the next push doesn't silently re-ship the broken version.

---

## 7. Monitoring & logs

- **Logs:** Vercel → Project → Logs / Render → Service → Logs / AWS EC2 → `sudo docker compose logs -f`
- **Health Endpoint:** `/api/health` exposes uptime, active routing policy, ANFIS epoch, and GP generation count
- **Dependencies:** Dependabot opens weekly update PRs and a maintenance report is emailed every Monday (see `.github/workflows/`)

---

## Known production limitations

- Render Free Tier spins down after 15 minutes of inactivity and takes ~25s to cold-start on the first request. The Next.js dashboard includes an instant local fallback telemetry mode while waking up the backend so the UI never appears broken.

---

<div align="center">

<h3>Tanish Poddar &amp; Krish</h3>

<p>
  <strong>Tanish Poddar</strong> ·
  <a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
  <a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square" alt="LinkedIn"></a>
  <a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hey%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>
</p>

<p>
  <strong>Krish</strong> ·
  <a href="https://github.com/krish-codess"><img src="https://img.shields.io/badge/GitHub-krish--codess-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="mailto:krishnakulgohel544@gmail.com"><img src="https://img.shields.io/badge/Email-krishnakulgohel544%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>
</p>

</div>
