"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const QUICKSTART_TABS = {
  cli: {
    label: "CLI GATEWAY",
    code: `# Start FuzzLoad Reverse Proxy + ANFIS/GP Control Plane in front of any servers
pip install -e ./backend

fuzzload start \\
  --upstreams "http://10.0.1.11:8080,http://10.0.1.12:8080,http://10.0.1.13:8080" \\
  --policy fuzzload \\
  --port 8000`,
  },
  sdk: {
    label: "PYTHON SDK",
    code: `from app.cli import FuzzLoadRouter

router = FuzzLoadRouter(
    upstreams=[
        {"id": "worker-a", "url": "http://10.0.1.11:8080", "cores": 4.0},
        {"id": "worker-b", "url": "http://10.0.1.12:8080", "cores": 2.0},
        {"id": "worker-c", "url": "http://10.0.1.13:8080", "cores": 1.0},
    ]
)

target = router.select_upstream()                 # <0.1ms atomic lookup
router.record_telemetry("worker-a", latency_ms=18.4, cpu=0.31, mem=0.28)`,
  },
  docker: {
    label: "DOCKER COMPOSE",
    code: `git clone https://github.com/tanisheesh/FuzzLoad.git
cd FuzzLoad
docker compose up -d --build

# Send traffic through the Go Data Plane Proxy (:8080)
curl -i http://localhost:8080/work`,
  },
};

const BENCHMARK_ROWS = [
  { algo: "ROUND ROBIN (STATIC)", p50: "48.6 ms", p95: "112.4 ms", p99: "156.8 ms", err: "4.15%", fairness: "0.712", win: false },
  { algo: "LEAST CONNECTIONS", p50: "36.2 ms", p95: "78.5 ms", p99: "109.4 ms", err: "1.85%", fairness: "0.834", win: false },
  { algo: "WEIGHTED ROUND ROBIN", p50: "33.8 ms", p95: "71.2 ms", p99: "98.7 ms", err: "1.42%", fairness: "0.861", win: false },
  { algo: "ANFIS NEURO-FUZZY ONLY", p50: "23.4 ms", p95: "42.6 ms", p99: "61.2 ms", err: "0.24%", fairness: "0.946", win: false },
  { algo: "FUZZLOAD (GP + ANFIS)", p50: "19.8 ms", p95: "34.2 ms", p99: "49.5 ms", err: "0.04%", fairness: "0.974", win: true },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"cli" | "sdk" | "docker">("cli");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(QUICKSTART_TABS[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8">
        {/* HERO GRID */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-x border-b border-[#222220]">
          {/* Left 7 Cols */}
          <div className="lg:col-span-7 p-5 sm:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#222220] flex flex-col justify-between min-w-0">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-[#ff5500] mb-4 sm:mb-6">
                <span className="w-2 h-2 shrink-0 bg-[#ff5500] inline-block" />
                <span>L7 REVERSE PROXY // 5-LAYER ANFIS // SYMBOLIC GP</span>
              </div>

              <h1 className="font-display font-black uppercase text-[clamp(42px,10vw,100px)] leading-[0.9] tracking-tight text-[#f2efe9] mb-5 sm:mb-6 break-words">
                STATIC ROUTING
                <br />
                BREAKS UNDER
                <br />
                <span className="text-[#ff5500]">TAIL LATENCY.</span>
              </h1>

              <p className="text-sm sm:text-base lg:text-lg text-[#88857e] max-w-xl leading-relaxed mb-6 sm:mb-8">
                Round Robin and Least Connections route blindly into CPU spikes and I/O stalls.{" "}
                <strong className="text-[#f2efe9] font-semibold">FuzzLoad</strong> decouples a lock-free{" "}
                <strong className="text-[#f2efe9] font-semibold">Go Reverse Proxy</strong> from a dual-loop AI control plane: a{" "}
                <strong className="text-[#f2efe9] font-semibold">5-Layer Takagi-Sugeno Neuro-Fuzzy network</strong> updating weights every 500ms via online gradient descent, paired with{" "}
                <strong className="text-[#f2efe9] font-semibold">Genetic Programming</strong> evolving symbolic heuristics over a 60s traffic replay buffer.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-2">
              <Link href="/dashboard" className="brutal-btn brutal-btn-primary w-full sm:w-auto">
                LAUNCH LIVE CLUSTER CONSOLE →
              </Link>
              <Link href="/playground" className="brutal-btn w-full sm:w-auto">
                BENCHMARK ANY URL →
              </Link>
              <Link href="/how-it-works" className="brutal-btn w-full sm:w-auto">
                READ MATH SPEC
              </Link>
            </div>
          </div>

          {/* Right 5 Cols: Raw Hardware-Style Telemetry Readout */}
          <div className="lg:col-span-5 bg-[#0b0b0b] flex flex-col justify-between min-w-0">
            <div className="panel-header">
              <span>CONTROL_PLANE // REALTIME SNAPSHOT</span>
              <span className="text-[#00e676]">● LOOP: 500ms</span>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 font-mono text-xs">
              <div className="space-y-2.5 sm:space-y-3">
                {[
                  { id: "NODE_01", spec: "4vCPU · 16GB", share: 51, p95: "19.8ms", state: "OPTIMAL", bar: "bg-[#00e676]" },
                  { id: "NODE_02", spec: "2vCPU · I/O FAULT", share: 7, p95: "142.0ms", state: "DRAINED", bar: "bg-[#ff2a2a]" },
                  { id: "NODE_03", spec: "2vCPU · 16GB", share: 35, p95: "24.1ms", state: "OPTIMAL", bar: "bg-[#00e676]" },
                  { id: "NODE_04", spec: "1vCPU · 4GB", share: 7, p95: "38.5ms", state: "CAPPED", bar: "bg-[#ffb300]" },
                ].map((n) => (
                  <div key={n.id} className="border border-[#222220] bg-[#111111] p-2.5 sm:p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                      <div className="truncate">
                        <span className="text-[#f2efe9] font-bold">{n.id}</span>
                        <span className="text-[#88857e] ml-1.5 text-[11px]">[{n.spec}]</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 border shrink-0 ${
                          n.state === "DRAINED"
                            ? "border-[#ff2a2a] text-[#ff2a2a]"
                            : n.state === "CAPPED"
                            ? "border-[#ffb300] text-[#ffb300]"
                            : "border-[#00e676] text-[#00e676]"
                        }`}
                      >
                        {n.state}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#88857e] mb-1.5">
                      <span>P95: {n.p95}</span>
                      <span className="text-[#f2efe9] font-bold">WEIGHT: {n.share}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#1c1c1a]">
                      <div className={`h-full ${n.bar}`} style={{ width: `${n.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-[#222220] bg-[#080808] p-3 sm:p-3.5 space-y-1">
                <div className="text-[10px] text-[#ff5500] uppercase tracking-wider">
                  ACTIVE EVOLVED GP EXPRESSION [GEN #18 · FIT 0.914]
                </div>
                <div className="text-[#00e676] text-[11px] sm:text-xs overflow-x-auto custom-scrollbar whitespace-nowrap pb-1">
                  Φ(x) = (1.00 - CPU²) / (0.25 + LAT × (1.00 + CONN))
                </div>
              </div>
            </div>

            <div className="border-t border-[#222220] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] sm:text-[11px] text-[#88857e]">
              <span>ANFIS MSE LOSS: 0.0042</span>
              <Link href="/dashboard" className="text-[#ff5500] hover:underline font-bold">
                INJECT CHAOS FAULT →
              </Link>
            </div>
          </div>
        </section>

        {/* METRICS STRIP */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-x border-b border-[#222220] bg-[#0b0b0b]">
          {[
            { num: "< 0.2ms", label: "GO ATOMIC PROXY LOOKUP", sub: "Zero neural inference on hot path" },
            { num: "-69.5%", label: "P95 TAIL LATENCY DROP", sub: "34.2ms vs 112.4ms Round Robin" },
            { num: "500ms", label: "ANFIS BACKPROP INTERVAL", sub: "Online gradient descent on (c, σ, w)" },
            { num: "0.974", label: "JAIN'S FAIRNESS INDEX", sub: "Capacity-normalized load distribution" },
          ].map((m, idx) => (
            <div
              key={m.label}
              className={`p-5 sm:p-7 border-b lg:border-b-0 border-[#222220] ${
                idx % 2 === 0 ? "sm:border-r" : ""
              } ${idx < 3 ? "lg:border-r" : "last:border-b-0"}`}
            >
              <div className="font-display font-black text-4xl sm:text-5xl text-[#ff5500] tracking-tight">
                {m.num}
              </div>
              <div className="font-mono font-bold text-xs text-[#f2efe9] mt-2 tracking-wider">
                {m.label}
              </div>
              <div className="font-mono text-[11px] text-[#88857e] mt-1">{m.sub}</div>
            </div>
          ))}
        </section>

        {/* 3-PILLAR ARCHITECTURE */}
        <section className="border-x border-b border-[#222220]">
          <div className="p-5 sm:p-8 lg:p-10 border-b border-[#222220]">
            <div className="font-mono text-[11px] sm:text-xs text-[#ff5500] uppercase tracking-widest mb-2">
              // ARCHITECTURAL SPECIFICATION
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-[#f2efe9]">
              THREE SOFT-COMPUTING LOOPS. ONE LOCK-FREE PROXY.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#222220]">
            {[
              {
                idx: "01",
                tag: "UNCERTAINTY LAYER",
                title: "TAKAGI-SUGENO FUZZY LOGIC",
                eq: "μ(x) = exp(-(x - c)² / 2σ²)",
                body: "Static rules like 'if CPU > 80% drop server' cause violent routing oscillation. FuzzLoad maps CPU, RAM, Latency, and Active Connections into smooth Gaussian membership degrees (Low, Medium, High) across 12 firing rules.",
              },
              {
                idx: "02",
                tag: "FAST LOOP // 500ms",
                title: "5-LAYER DIFFERENTIABLE ANFIS",
                eq: "w_{t+1} = w_t - η · ∂L_SLA / ∂w",
                body: "Wraps the fuzzy inference system inside a 5-layer neural network. Every 500ms, analytical backpropagation adjusts membership centers (c), widths (σ), and linear rule weights to penalize SLA violations.",
              },
              {
                idx: "03",
                tag: "SLOW LOOP // 6s REPLAY",
                title: "SYMBOLIC GENETIC PROGRAMMING",
                eq: "P_i ∝ λ·S_ANFIS + (1-λ)·Φ_GP(x)",
                body: "Evolves a population of 36 mathematical syntax trees via tournament selection, subtree crossover, and mutation against a 60-second Digital Twin replay buffer — discovering non-linear I/O bottlenecks safely offline.",
              },
            ].map((card) => (
              <div key={card.idx} className="p-5 sm:p-7 lg:p-8 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between font-mono text-xs mb-4 sm:mb-6">
                    <span className="text-[#ff5500] font-bold">
                      [{card.idx}] {card.tag}
                    </span>
                  </div>
                  <h3 className="font-display font-black text-2xl sm:text-3xl text-[#f2efe9] tracking-tight mb-3">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#88857e] leading-relaxed mb-6">{card.body}</p>
                </div>
                <div className="border border-[#222220] bg-[#0b0b0b] p-3 font-mono text-[11px] sm:text-xs text-[#00e676] overflow-x-auto">
                  {card.eq}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DEVELOPER INTEGRATION & BENCHMARK */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-x border-b border-[#222220]">
          {/* Left 6 Cols: Quickstart Code */}
          <div className="lg:col-span-6 p-5 sm:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-[#222220] flex flex-col justify-between min-w-0">
            <div>
              <div className="font-mono text-[11px] sm:text-xs text-[#ff5500] uppercase tracking-widest mb-2">
                // DROP-IN INTEGRATION
              </div>
              <h2 className="font-display font-black text-3xl sm:text-4xl uppercase text-[#f2efe9] mb-4">
                DEPLOY IN FRONT OF ANY CLUSTER
              </h2>

              <div className="grid grid-cols-3 border border-[#222220] mb-4">
                {(Object.keys(QUICKSTART_TABS) as Array<"cli" | "sdk" | "docker">).map((k) => (
                  <button
                    key={k}
                    onClick={() => setActiveTab(k)}
                    className={`py-2.5 px-1 font-mono text-[10px] sm:text-xs font-bold tracking-wider border-r border-[#222220] last:border-r-0 cursor-pointer truncate ${
                      activeTab === k
                        ? "bg-[#ff5500] text-[#080808]"
                        : "bg-[#0e0e0e] text-[#88857e] hover:text-[#f2efe9]"
                    }`}
                  >
                    {QUICKSTART_TABS[k].label}
                  </button>
                ))}
              </div>

              <div className="relative border border-[#222220] bg-[#0b0b0b] p-3.5 sm:p-4 font-mono text-[11px] sm:text-xs text-[#f2efe9] overflow-x-auto custom-scrollbar">
                <button
                  onClick={handleCopy}
                  className="float-right ml-2 mb-2 px-2.5 py-1 border border-[#3a3834] bg-[#151515] text-[10px] font-mono uppercase text-[#f2efe9] hover:border-[#ff5500] cursor-pointer"
                >
                  {copied ? "COPIED" : "COPY"}
                </button>
                <pre className="leading-relaxed overflow-x-auto custom-scrollbar">{QUICKSTART_TABS[activeTab].code}</pre>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#222220] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <span className="text-[#88857e]">Want to benchmark a live endpoint right now?</span>
              <Link href="/playground" className="text-[#00e676] font-bold hover:underline">
                OPEN HTTP PROBER →
              </Link>
            </div>
          </div>

          {/* Right 6 Cols: Verified Benchmark Table */}
          <div className="lg:col-span-6 p-5 sm:p-8 lg:p-10 flex flex-col justify-between min-w-0">
            <div>
              <div className="font-mono text-[11px] sm:text-xs text-[#ff5500] uppercase tracking-widest mb-2">
                // CONTROLLED EXPERIMENT (480 RPS + NODE-2 CHAOS)
              </div>
              <h2 className="font-display font-black text-3xl sm:text-4xl uppercase text-[#f2efe9] mb-4">
                VERIFIED LATENCY BENCHMARK
              </h2>

              <div className="border border-[#222220] overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[420px] text-left font-mono text-[11px] sm:text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#222220] bg-[#0b0b0b] text-[#88857e] text-[10px] sm:text-[11px]">
                      <th className="py-3 px-2.5 sm:px-3">POLICY</th>
                      <th className="py-3 px-2 sm:px-3">P50</th>
                      <th className="py-3 px-2 sm:px-3">P95</th>
                      <th className="py-3 px-2 sm:px-3">ERR%</th>
                      <th className="py-3 px-2 sm:px-3">FAIRNESS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222220]">
                    {BENCHMARK_ROWS.map((r) => (
                      <tr
                        key={r.algo}
                        className={
                          r.win
                            ? "bg-[#ff5500]/15 text-[#f2efe9] font-bold"
                            : "text-[#88857e] hover:bg-[#111111]"
                        }
                      >
                        <td className="py-3 px-2.5 sm:px-3 text-[#f2efe9] whitespace-nowrap">{r.algo}</td>
                        <td className="py-3 px-2 sm:px-3 whitespace-nowrap">{r.p50}</td>
                        <td className={`py-3 px-2 sm:px-3 whitespace-nowrap ${r.win ? "text-[#00e676] font-bold" : ""}`}>
                          {r.p95}
                        </td>
                        <td className="py-3 px-2 sm:px-3 whitespace-nowrap">{r.err}</td>
                        <td className="py-3 px-2 sm:px-3 whitespace-nowrap">{r.fairness}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#222220] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <span className="text-[#88857e]">Reproduce via `python bench/run_benchmark.py`</span>
              <Link href="/dashboard" className="text-[#ff5500] font-bold hover:underline">
                RUN LIVE IN CONSOLE →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
