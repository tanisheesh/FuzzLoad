"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ArrowRight,
  Brain,
  Cpu,
  GitBranch,
  Layers,
  Network,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

const ANFIS_LAYERS = [
  {
    layer: "Layer 1",
    title: "Gaussian Fuzzification Neurons",
    formula: "μ_{A_{m,j}}(x_m) = exp( - (x_m - c_{m,j})² / (2 σ_{m,j}²) )",
    desc: "Takes crisp normalized server inputs x = [CPU, MEM, LAT, CONN] ∈ [0, 1] and computes smooth membership degrees for Low, Medium, and High using trainable centers (c) and spreads (σ).",
  },
  {
    layer: "Layer 2",
    title: "Product T-Norm Rule Firing (Π Layer)",
    formula: "w_k(x) = μ_CPU(x_1) × μ_MEM(x_2) × μ_LAT(x_3) × μ_CONN(x_4)",
    desc: "Evaluates 12 curated Takagi-Sugeno fuzzy rules covering CPU saturation, memory pressure, and non-linear I/O latency bottlenecks.",
  },
  {
    layer: "Layer 3",
    title: "Rule Normalization (N Layer)",
    formula: "w̄_k(x) = w_k(x) / Σ_{r=1}^{12} w_r(x)",
    desc: "Normalizes each rule's firing strength relative to total activation across the rule base so weights sum to 1.0.",
  },
  {
    layer: "Layer 4",
    title: "Adaptive First-Order Takagi-Sugeno Consequents",
    formula: "f_k(x) = w̄_k · (p_k·CPU + q_k·MEM + r_k·LAT + s_k·CONN + b_k)",
    desc: "Computes linear consequent polynomials per rule. Coefficients (p, q, r, s, b) are updated online via analytical gradient descent.",
  },
  {
    layer: "Layer 5",
    title: "Sigmoid Defuzzification & Online Backpropagation",
    formula: "S_ANFIS(x) = 1 + 99 · σ( Σ w̄_k f_k(x) )",
    desc: "Outputs a bounded server health score in [1, 100]. Every 500ms, the error between observed P95 latency and target SLA backpropagates through Layers 5 → 4 → 1.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-10 space-y-12">
        {/* Hero Header */}
        <div className="border-b border-slate-800 pb-8 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
            Mathematical Formulation &amp; Systems Architecture
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            How FuzzLoad Combines Fuzzy Logic, Neural Networks &amp; Genetic Programming
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
            A complete walkthrough of the dual-loop soft-computing control plane and lock-free Go reverse proxy data plane.
          </p>
        </div>

        {/* Section 1: Decoupled Data Plane vs Control Plane */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            1. Decoupled Data Plane (Go) vs. AI Control Plane (Python)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Running neural network gradient steps or evolutionary tree searches inside an HTTP proxy handler would add tens of milliseconds of latency to every user request. FuzzLoad separates packet forwarding from AI optimization:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5 space-y-2">
              <div className="text-xs font-mono text-cyan-400 uppercase">Data Plane · &lt; 0.2ms per Request</div>
              <div className="text-base font-bold text-white">Go Reverse Proxy (`httputil.ReverseProxy`)</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Maintains a lock-free atomic array of server routing probabilities <code className="text-slate-200">P = [P_1, P_2, P_3, P_4]</code>. When an HTTP request arrives, it selects a healthy backend node in microseconds and records sliding-window P50/P95/P99 latency.
              </p>
            </div>
            <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5 space-y-2">
              <div className="text-xs font-mono text-indigo-400 uppercase">Control Plane · 500ms &amp; 6s Loops</div>
              <div className="text-base font-bold text-white">Python ANFIS + GP Coordinator</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Asynchronously pulls telemetry snapshots, runs the 5-Layer ANFIS Fast Loop every 500ms and the Genetic Programming Slow Loop every 6 seconds, and pushes updated atomic weights back to the Go proxy.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: 5-Layer ANFIS Architecture */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            2. Fast Loop: 5-Layer Differentiable Neuro-Fuzzy Network (ANFIS)
          </h2>
          <div className="space-y-3">
            {ANFIS_LAYERS.map((item) => (
              <div
                key={item.layer}
                className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {item.layer}
                    </span>
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 shrink-0">
                  {item.formula}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Genetic Programming Symbolic Optimizer */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            3. Slow Loop: Tree-Based Genetic Programming &amp; Digital Twin Replay Buffer
          </h2>
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 text-xs sm:text-sm text-slate-300">
            <p className="leading-relaxed">
              While ANFIS tunes continuous weights smoothly, sudden workload shifts (such as an I/O lock where CPU stays low at 20% while latency jumps to 180ms) benefit from non-linear symbolic expressions. The GP engine evolves syntax trees built from:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-indigo-400 font-semibold mb-1">Terminal Set (T)</div>
                <div>CPU, MEM, LAT, CONN, ERR, Constants ∈ [0.1, 2.0]</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-emerald-400 font-semibold mb-1">Primitive Function Set (F)</div>
                <div>+, -, *, protected_div, min, max, exp, sqrt, sq</div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 font-mono text-xs space-y-1.5">
              <div className="text-indigo-300 font-semibold">
                Why evaluate on a 60-Second Digital Twin Replay Buffer?
              </div>
              <p className="font-sans text-slate-400">
                Testing randomly mutated GP trees directly on live production traffic would route requests to overloaded servers whenever a low-fitness individual is evaluated. By replaying the last 60 seconds of recorded telemetry in memory, FuzzLoad evaluates 36 individuals across multiple generations in &lt;25ms with zero risk to live users.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">See All Three Engines Running Live</h3>
            <p className="text-xs text-slate-400">
              Inject synthetic chaos faults and inspect the ANFIS curves and GP expression tree in real time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              <span>Launch Live Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/playground"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
            >
              <span>Try Proxy Playground</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
