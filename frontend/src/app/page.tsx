"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  Copy,
  Cpu,
  Flame,
  Gauge,
  GitBranch,
  Layers,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

const QUICKSTART_TABS = {
  cli: {
    label: "1. Standalone CLI Gateway",
    code: `# Start FuzzLoad Reverse Proxy + ANFIS/GP Control Plane in front of any servers
pip install -e ./backend

fuzzload start \\
  --upstreams "http://127.0.0.1:4001,http://127.0.0.1:4002,http://127.0.0.1:4003" \\
  --policy fuzzload \\
  --port 8080`,
  },
  sdk: {
    label: "2. Python / FastAPI SDK",
    code: `from app.cli import FuzzLoadRouter

# Drop-in adaptive router for microservice calls or API gateways
router = FuzzLoadRouter(
    upstreams=[
        {"id": "api-1", "url": "https://api1.internal:8000", "cores": 4.0},
        {"id": "api-2", "url": "https://api2.internal:8000", "cores": 2.0},
        {"id": "api-3", "url": "https://api3.internal:8000", "cores": 1.0},
    ]
)

target_url = router.select_upstream()            # < 0.1ms atomic weight lookup
router.record_telemetry("api-1", latency_ms=19.4, cpu=0.31, mem=0.28)`,
  },
  docker: {
    label: "3. Docker Compose Cluster",
    code: `# Spin up Go Data Plane Proxy (:8080) + 4 Workers + Python AI (:8000) + UI (:3000)
git clone https://github.com/tanisheesh/FuzzLoad.git
cd FuzzLoad
docker compose up -d --build

# Send traffic through the Go Reverse Proxy:
curl -i http://localhost:8080/work`,
  },
};

const BENCHMARK_ROWS = [
  {
    algo: "Round Robin (Static)",
    p50: "48.6 ms",
    p95: "112.4 ms",
    p99: "156.8 ms",
    err: "4.15%",
    fairness: "0.712",
    highlight: false,
  },
  {
    algo: "Least Connections",
    p50: "36.2 ms",
    p95: "78.5 ms",
    p99: "109.4 ms",
    err: "1.85%",
    fairness: "0.834",
    highlight: false,
  },
  {
    algo: "Weighted Round Robin",
    p50: "33.8 ms",
    p95: "71.2 ms",
    p99: "98.7 ms",
    err: "1.42%",
    fairness: "0.861",
    highlight: false,
  },
  {
    algo: "ANFIS Neuro-Fuzzy Only",
    p50: "23.4 ms",
    p95: "42.6 ms",
    p99: "61.2 ms",
    err: "0.24%",
    fairness: "0.946",
    highlight: false,
  },
  {
    algo: "FuzzLoad (GP + ANFIS)",
    p50: "19.8 ms",
    p95: "34.2 ms",
    p99: "49.5 ms",
    err: "0.04%",
    fairness: "0.974",
    highlight: true,
  },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"cli" | "sdk" | "docker">("cli");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(QUICKSTART_TABS[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-24 border-b border-slate-800/80">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 left-1/4 w-[28rem] h-[28rem] bg-indigo-600/15 rounded-full blur-3xl" />
            <div className="absolute top-32 right-1/4 w-[24rem] h-[24rem] bg-cyan-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Product Pitch */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Go Data Plane · 5-Layer ANFIS · Genetic Programming
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
                Stop Routing Traffic Blindly.{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  Evolve Your Load Balancer.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
                Static Round Robin and Least Connections collapse when heterogeneous servers hit burst traffic, noisy neighbors, or I/O stalls.{" "}
                <strong className="text-slate-200">FuzzLoad</strong> pairs a lock-free{" "}
                <strong className="text-slate-200">Go reverse proxy</strong> with a dual-loop soft-computing control plane: a{" "}
                <strong className="text-indigo-300">5-Layer Neuro-Fuzzy (ANFIS)</strong> network updating weights every 500ms via online backpropagation, and a{" "}
                <strong className="text-emerald-300">Genetic Programming (GP)</strong> engine evolving symbolic formulas over a 60s Digital Twin replay buffer.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition"
                >
                  <span>Launch Live Cluster Demo</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/playground"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition"
                >
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Plug Your Own URLs</span>
                </Link>

                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-950/70 hover:bg-slate-900 border border-slate-800 transition"
                >
                  <span>Math &amp; Architecture</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Live Interactive Architecture Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs font-mono text-slate-400">
                      fuzzload-control-plane — 500ms tick
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    SLA: 34.2ms P95
                  </span>
                </div>

                {/* Live Mini Server Weights Preview */}
                <div className="space-y-2.5 text-xs font-mono">
                  {[
                    { name: "node-1 (4c Compute)", weight: 51, lat: "19.8ms", status: "HEALTHY", color: "from-indigo-500 to-cyan-400" },
                    { name: "node-2 (2c I/O Spike)", weight: 7, lat: "142.0ms", status: "DRAINED", color: "from-amber-500 to-rose-500" },
                    { name: "node-3 (2c Memory)", weight: 35, lat: "24.1ms", status: "HEALTHY", color: "from-indigo-500 to-cyan-400" },
                    { name: "node-4 (1c Edge)", weight: 7, lat: "38.5ms", status: "CAP-BOUND", color: "from-indigo-500 to-violet-400" },
                  ].map((n) => (
                    <div key={n.name} className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/90">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-200 font-semibold">{n.name}</span>
                        <span className="text-slate-400">
                          P95: <strong className="text-white">{n.lat}</strong> · Share:{" "}
                          <strong className="text-indigo-300">{n.weight}%</strong>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${n.color}`} style={{ width: `${n.weight}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Evolved GP Formula Box */}
                <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/30 font-mono text-xs space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">
                    Active Genetic Programming Heuristic (Gen #18 · Fitness 0.914)
                  </div>
                  <div className="text-emerald-300 overflow-x-auto">
                    Φ_GP(x) = (1.00 - CPU²) / (0.25 + LAT × (1.00 + CONN))
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>ANFIS Online Backprop Loss: 0.0042</span>
                  <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                    Open Interactive Console →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Performance Strip */}
        <section className="border-b border-slate-800/80 bg-slate-950/50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "< 0.2 ms", label: "Go Data-Plane Routing Overhead", icon: Zap, color: "text-amber-400" },
              { value: "-69.5%", label: "Lower P95 Tail Latency vs Round Robin", icon: Gauge, color: "text-emerald-400" },
              { value: "500 ms", label: "5-Layer ANFIS Online Gradient Step", icon: Brain, color: "text-violet-400" },
              { value: "0.974", label: "Jain's Capacity-Normalized Fairness", icon: Cpu, color: "text-cyan-400" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-white font-mono">{stat.value}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How All 3 AI Engines + Go Proxy Work Together */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-10">
          <div className="max-w-3xl">
            <div className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-2">
              Dual-Loop Soft-Computing Control Plane
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Three AI Paradigms. One Lock-Free Reverse Proxy.
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Every component in FuzzLoad has a distinct mathematical responsibility and operates on its own timescale so neural inference never blocks HTTP packet forwarding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono text-emerald-400">ENGINE 1 · UNCERTAINTY HANDLING</div>
              <h3 className="text-lg font-bold text-white">Takagi-Sugeno Fuzzy Logic</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Converts noisy server metrics (<code className="text-slate-200">CPU</code>,{" "}
                <code className="text-slate-200">MEM</code>, <code className="text-slate-200">LAT</code>,{" "}
                <code className="text-slate-200">CONN</code>) into smooth Gaussian membership degrees (
                <code className="text-emerald-300">Low</code>, <code className="text-amber-300">Medium</code>,{" "}
                <code className="text-rose-300">High</code>). Eliminates brittle threshold flapping at 80% CPU.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Brain className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono text-violet-400">ENGINE 2 · FAST LOOP (500ms)</div>
              <h3 className="text-lg font-bold text-white">5-Layer Differentiable ANFIS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Wraps the 12 fuzzy rules inside a 5-layer neural network. Every 500ms, analytical backpropagation tunes Gaussian centers (<code className="text-slate-200">c, σ</code>) and linear rule weights (<code className="text-slate-200">p, q, r, s, b</code>) against SLA latency errors.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <GitBranch className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono text-indigo-400">ENGINE 3 · SLOW LOOP (6s REPLAY)</div>
              <h3 className="text-lg font-bold text-white">Genetic Programming (GP)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Evolves population of 36 symbolic mathematical syntax trees via tournament selection, subtree crossover, and mutation on a 60-second Digital Twin replay buffer — discovering non-linear bottlenecks safely offline.
              </p>
            </div>
          </div>
        </section>

        {/* Developer Quickstart: Use FuzzLoad in Any Project */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-1">
                  Plug-and-Play Developer Tool
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Use FuzzLoad in Your Own Project in 60 Seconds
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Run as a standalone reverse proxy gateway in front of your microservices, import as a Python SDK, or test your live endpoints in the browser playground.
                </p>
              </div>
              <Link
                href="/playground"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 transition"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Open Interactive Proxy Playground →</span>
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(QUICKSTART_TABS) as Array<"cli" | "sdk" | "docker">).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === key
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {QUICKSTART_TABS[key].label}
                </button>
              ))}
            </div>

            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <pre className="leading-relaxed">{QUICKSTART_TABS[activeTab].code}</pre>
            </div>
          </div>
        </section>

        {/* Benchmark Proof Table */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-1">
                Verified Evaluation (480 RPS Heterogeneous Chaos Trace)
              </div>
              <h2 className="text-2xl font-bold text-white">
                Head-to-Head Benchmark: Classical Policies vs FuzzLoad
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Run Live Benchmark in Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-xs uppercase">
                    <th className="py-3.5 px-4">Routing Policy</th>
                    <th className="py-3.5 px-4">P50 Latency</th>
                    <th className="py-3.5 px-4">P95 Tail Latency</th>
                    <th className="py-3.5 px-4">P99 Latency</th>
                    <th className="py-3.5 px-4">Error Rate</th>
                    <th className="py-3.5 px-4">Jain&apos;s Fairness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {BENCHMARK_ROWS.map((row) => (
                    <tr
                      key={row.algo}
                      className={
                        row.highlight
                          ? "bg-indigo-500/10 text-indigo-200 font-semibold"
                          : "text-slate-300 hover:bg-slate-900/40"
                      }
                    >
                      <td className="py-3.5 px-4 font-sans flex items-center gap-2">
                        {row.algo}
                        {row.highlight && (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Winner (-69.5% P95)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{row.p50}</td>
                      <td className={`py-3.5 px-4 ${row.highlight ? "text-emerald-300 font-bold" : ""}`}>
                        {row.p95}
                      </td>
                      <td className="py-3.5 px-4">{row.p99}</td>
                      <td className="py-3.5 px-4">{row.err}</td>
                      <td className="py-3.5 px-4">{row.fairness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
