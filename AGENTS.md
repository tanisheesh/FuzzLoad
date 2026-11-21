# FuzzLoad — Agent Development Guidelines

Follow these rules strictly on every file you create or modify in **FuzzLoad**.

---

## 1. File Organization & Architecture

- **File naming:**
  - TypeScript / Next.js (`frontend/`): ALWAYS use `kebab-case` (`fuzzload-engine.ts`), except framework-required files (`page.tsx`, `layout.tsx`, `route.ts`, `next.config.mjs`).
  - Python (`backend/`): ALWAYS use `snake_case` for modules/functions/variables and `PascalCase` for classes (`anfis.py`, `gp_optimizer.py`, `art_bam_memory.py`).
  - Go (`proxy-go/`): Use short lowercase filenames (`router.go`, `telemetry.go`, `health.go`, `adaptive.go`, `router_test.go`).
- **File size limit:** Keep new modules focused and **under 300 lines**. Split cohesive logic rather than expanding monoliths.
- **Layered separation:**
  - `proxy-go/pkg/fuzzload/` — Zero-allocation lock-free Go SDK (`atomic.Pointer` routing table, `LatencyRing`, circuit breaker, pure-Go adaptive loop).
  - `proxy-go/cmd/fuzzload-proxy/` — Thin CLI entrypoint wiring flags and HTTP server onto `pkg/fuzzload`.
  - `backend/app/ai_engine/` — Pure soft-computing engines (`TakagiSugenoANFIS`, `GeneticProgrammingOptimizer`, `ART1`/`ART2`/`BAM`).
  - `backend/app/cluster/` — Cluster coordinator, Digital Twin replay simulator, and bidirectional Go proxy sync.
  - `backend/fuzzload/` & `backend/app/cli.py` — Public Python SDK (`from fuzzload import FuzzLoadRouter`) and `fuzzload` CLI.
  - `frontend/src/lib/` — Shared TypeScript types and client-side Digital Twin fallback engine.
  - `frontend/src/components/` — Reusable navigation and layout components.
  - `frontend/src/app/` — App Router pages (`/`, `/dashboard`, `/playground`, `/how-it-works`) and `/api/probe` route handler.
- **App Router only (Next.js):** Never add or expand routes in `pages/`. Always use `frontend/src/app/`.

---

## 2. Code Style & Strictness

- **No dead code or debug clutter:** Never leave unused imports, commented-out blocks, or stray `console.log` / `print` statements.
- **Named exports at definition:** Prefer named exports (`export function ...`) in shared libraries; use `export default` only where Next.js requires it (`page.tsx`, `layout.tsx`).
- **Hot-path performance (Go):** Never add mutex locks or heap allocations inside `SelectUpstream()` or `LatencyRing.Record()`. Keep `BenchmarkSelectUpstreamFuzzLoad` at `0 B/op, 0 allocs/op`.
- **Type safety:** NEVER use `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck`. Avoid `any` — validate untrusted payloads with explicit guards (TS) or Pydantic schemas (Python).
- **Error handling:** Never leave silent `catch {}` blocks at API or I/O boundaries without intentional fallback handling. Guard all GP/ANFIS math against `NaN`/`Inf` and division by zero.
- **Directives first:** In Next.js Client Components, put `"use client";` on **line 1** before imports.

---

## 3. UI Craft & Anti-AI-Slop Rules

- **Brutalist hardware aesthetic:** Stick strictly to FuzzLoad's industrial dark palette (`#080808` / `#0b0b0b` / `#111111`, `#222220` 1px borders, `#ff5500` primary accent, `#00e676` optimal, `#ffb300` warning, `#ff2a2a` fault) and `tabular-nums` / monospace telemetry alignment.
- **Banned clichés:** No purple/indigo/pink linear gradients, neon glows, emoji-prefixed app UI headings, dead buttons, or `window.alert()`.
- **Accessibility & responsiveness:** Semantic HTML (`<button>`, `<label>`, `<main>`), visible focus rings, WCAG AA contrast, zero horizontal overflow at `375px` and `1280px`.

---

## 4. Security Rules

- **Boundary validation:** Validate all FastAPI inputs with Pydantic (`backend/app/main.py`) and all `/api/probe` inputs with strict URL + bounds validation (`frontend/src/app/api/probe/route.ts`).
- **SSRF defense:** Both `/api/probe` (Next.js) and `/api/proxy/probe` (FastAPI) MUST block loopback, private IPv4/IPv6 ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`), `.local`/`.internal` hosts, embedded credentials, and unsafe redirects.
- **Secrets isolation:** Never expose server tokens via `NEXT_PUBLIC_`. Never commit `.env*` files; document new vars in `.env.example` with safe defaults/empty values.
- **Security headers:** Keep `frontend/vercel.json` security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) intact.

---

## 5. Testing & Verification

- **No work is complete without tests:**
  - Go SDK changes → unit tests + race detector (`-race`) + zero-alloc microbenchmark check.
  - Python engine / API / CLI changes → `pytest` covering happy paths + boundary/chaos/SSRF edge cases.
  - Frontend changes → `tsc --noEmit` + `next build` + zero console errors at `375px` and `1280px`.
- **Never bypass checks:** Never delete tests, add `.skip`, or weaken CI/lint/type rules to force green builds.

### Verification Commands (Run Before Finishing)

```bash
# Go SDK & Proxy (proxy-go/)
cd proxy-go && go vet ./... && go test -v -race ./... && go test -run=^$ -bench=. -benchmem ./pkg/fuzzload && go build ./...

# Python AI Control Plane, SDK & CLI (backend/)
cd backend && python -m compileall -q app fuzzload && python -m pytest -v

# Next.js Frontend (frontend/)
cd frontend && pnpm run typecheck && pnpm run build
```

If `coderabbit` CLI is installed locally, optionally run a pre-PR review on your changes:

```bash
coderabbit review --agent --uncommitted
```

---

## 6. Git & Commit Rules

- **Atomic commits:** `<emoji> [#issue] [scope:] <present tense lowercase message>` (see `CONTRIBUTING.md`).
- **PRs:** Use plain-English **past-tense** PR titles, fill the PR template, and include docs / `.env.example` / tests in the same PR.
- **Safety:** Never force-push or run `git reset --hard` on `main`. Record any production rollback SHA and reason in a commit or PR.

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
