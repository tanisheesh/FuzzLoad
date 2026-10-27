# Local Setup — FuzzLoad

> **Just want to try it?** Use the live demo at [https://fuzzload.tanisheesh.in](https://fuzzload.tanisheesh.in) — no setup needed.
> This guide is for running FuzzLoad locally or self-hosting it.

---

## Prerequisites

- **Node.js 20+** and `npm` (for the Next.js 16 observability dashboard)
- **Python 3.11+** and `pip` (for the ANFIS + Genetic Programming AI Control Plane)
- **Go 1.22+** *(optional for native Go execution; Docker handles it automatically if Go is not installed)*
- **Docker & Docker Compose** *(optional, for full multi-container cluster mode)*

---

## 1. Clone and install

```bash
git clone https://github.com/tanisheesh/FuzzLoad
cd FuzzLoad
```

### Install Backend (Python AI Control Plane)
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### Install Frontend (Next.js Dashboard)
```bash
cd frontend
npm install
cd ..
```

---

## 2. Environment variables

Copy `.env.example` to `.env` in the root (and `.env.local` in `frontend/` if customizing ports):

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL of the FuzzLoad AI Control Plane (`http://localhost:8000` locally) |
| `GO_PROXY_URL` | URL of the Go Data Plane Proxy (`http://localhost:8080` when running Go/Docker) |
| `ANFIS_LEARNING_RATE` | Learning rate for online ANFIS gradient descent (default `0.015`) |
| `GP_POPULATION_SIZE` | Number of symbolic trees in the Genetic Programming population (default `40`) |

---

## 3. Run locally

You can run FuzzLoad in **two modes**:

### Mode A: Full Multi-Container Cluster with Docker Compose (Go Proxy + 4 Workers + Python AI + Next.js UI)

```bash
docker compose up --build
```

- **Dashboard UI:** `http://localhost:3000`
- **Python AI Control Plane API:** `http://localhost:8000`
- **Go Data Plane Reverse Proxy:** `http://localhost:8080`

### Mode B: Fast Local Dev (No Docker Needed)

Terminal 1 — Start the AI Control Plane & Integrated Cluster Simulator:
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — Start the Next.js 16 Dashboard:
```bash
cd frontend
npm run dev
```

*(Optional) Terminal 3 — If Go is installed locally, run the standalone Go Reverse Proxy & Worker Nodes:*
```bash
cd proxy-go
go run ./cmd/fuzzload-proxy
```

FuzzLoad Dashboard will be running at `http://localhost:3000`.

---

## 4. Deploy to production

See [DEPLOY.md](DEPLOY.md) for production deployment on **Vercel**, **AWS EC2 (Free Tier / Minimal Cost)**, and **Render**, plus custom domain and rollback steps.

---

## Known local-only limitations

- When running in Mode B without Docker on Windows/macOS, Linux cgroup CPU throttling is emulated by the calibrated worker queueing model rather than kernel cgroups. Use `docker compose up` to enforce hard Linux container CPU quotas (`cpus: 0.25`, `0.50`, `1.00`).

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
