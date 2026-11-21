# Changelog

All notable changes to **FuzzLoad** are documented here.

---

## [Unreleased]

### 🔒 Security
- Hardened SSRF protections on `/api/probe` (Next.js) and `/api/proxy/probe` (FastAPI) to block loopback, private IPv4/IPv6 ranges, `.local`/`.internal` hosts, embedded credentials, and unsafe redirects
- Added `frontend/vercel.json` production security headers (`HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`)
- Restricted FastAPI CORS origins via `CORS_ORIGINS` environment variable

### 📚 Docs & Automation
- Added runtime `AGENTS.md`, `docs/USAGE.md` (Go SDK, Python SDK, CLI & API reference), `.coderabbit.yaml`, `.github/CODEOWNERS`, and `.github/labeler.yml`
- Upgraded CI/security automation with CodeQL (Go, Python, JS/TS), Gitleaks secret scanning, Dependency Review, PR Labeler, tag-based Releases, and Renovate (`Yantra [bot]`)

---

## [1.0.0] — 2026-11-21

### ✨ Added
- Published zero-allocation lock-free Go SDK (`github.com/tanisheesh/FuzzLoad/proxy-go/pkg/fuzzload@v1.0.0`) with Copy-on-Write (`atomic.Pointer`) routing table (`4.8–7.5 ns/op`, `0 B/op`, `0 allocs/op`), atomic latency ring buffer, passive circuit breaker, active `/healthz` prober, Prometheus `/metrics`, and standalone pure-Go Neuro-Fuzzy + GP auto-adaptation loop
- Configurable Go reverse proxy CLI (`fuzzload-proxy`) supporting `--port`, `--upstreams`, `--weights`, `--policy`, `--config`, `--spawn-workers`, `--standalone-auto`, and `--loadgen-rps`
- Bidirectional Go Data Plane <-> Python AI Control Plane telemetry, weight, and chaos synchronization
- Public Python SDK (`from fuzzload import FuzzLoadRouter`) and multi-command CLI (`fuzzload start`, `fuzzload probe`, `fuzzload bench`)
- 5-Layer Takagi-Sugeno ANFIS with online momentum backpropagation, Symbolic Genetic Programming + Bitwise FLC-GA co-optimizer, and ART1/ART2 + Exponential BAM associative memory
- Next.js 16 observability dashboard (`/`, `/dashboard`, `/playground`, `/how-it-works`) with live topology, Gaussian membership curves, GP syntax tree inspector, chaos injection, real HTTP endpoint prober, and CSV/JSON/LaTeX exporters

---

[Unreleased]: https://github.com/tanisheesh/FuzzLoad/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tanisheesh/FuzzLoad/releases/tag/v1.0.0

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
