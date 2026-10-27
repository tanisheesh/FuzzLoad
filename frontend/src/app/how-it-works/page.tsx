"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ANFIS_LAYERS = [
  {
    layer: "LAYER 01",
    title: "GAUSSIAN FUZZIFICATION NEURONS",
    formula: "μ_{A_{m,j}}(x_m) = exp( - (x_m - c_{m,j})² / (2 σ_{m,j}²) )",
    desc: "Maps crisp normalized server telemetry x = [CPU, MEM, LAT, CONN] ∈ [0, 1] into smooth membership degrees (Low, Medium, High) governed by trainable premise centers (c) and spreads (σ).",
  },
  {
    layer: "LAYER 02",
    title: "PRODUCT T-NORM RULE FIRING (Π LAYER)",
    formula: "w_k(x) = μ_CPU(x_1) × μ_MEM(x_2) × μ_LAT(x_3) × μ_CONN(x_4)",
    desc: "Evaluates 12 Takagi-Sugeno fuzzy rules covering CPU saturation, memory pressure, and non-linear I/O latency stalls.",
  },
  {
    layer: "LAYER 03",
    title: "RULE NORMALIZATION (N LAYER)",
    formula: "w̄_k(x) = w_k(x) / Σ_{r=1}^{12} w_r(x)",
    desc: "Computes relative firing strengths across the 12-rule base so activations sum to unity.",
  },
  {
    layer: "LAYER 04",
    title: "ADAPTIVE TAKAGI-SUGENO CONSEQUENTS",
    formula: "f_k(x) = w̄_k · (p_k·CPU + q_k·MEM + r_k·LAT + s_k·CONN + b_k)",
    desc: "Evaluates first-order linear consequent polynomials per rule. Consequent parameters (p, q, r, s, b) adapt online every 500ms.",
  },
  {
    layer: "LAYER 05",
    title: "DEFUZZIFICATION & ONLINE BACKPROPAGATION",
    formula: "S_ANFIS(x) = 1 + 99 · σ( Σ w̄_k f_k(x) )",
    desc: "Outputs crisp capacity score in [1, 100]. Whenever observed P95 latency exceeds the target SLA, analytical gradients propagate through Layers 5 → 4 → 1.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
        <div className="border border-[#222220] bg-[#0e0e0e] p-5 sm:p-8 lg:p-10">
          <div className="font-mono text-[11px] sm:text-xs text-[#ff5500] uppercase tracking-widest mb-2">
            // MATHEMATICAL &amp; SYSTEMS SPECIFICATION
          </div>
          <h1 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl uppercase text-[#f2efe9]">
            DUAL-LOOP SOFT-COMPUTING ARCHITECTURE
          </h1>
          <p className="text-xs sm:text-base text-[#88857e] mt-3 max-w-3xl leading-relaxed">
            How FuzzLoad combines a lock-free Go Reverse Proxy Data Plane with a 5-Layer Differentiable Neuro-Fuzzy (ANFIS) Fast Loop and a Symbolic Genetic Programming (GP) Slow Loop.
          </p>
        </div>

        {/* 5-LAYER ANFIS BREAKDOWN */}
        <section className="panel-frame">
          <div className="panel-header">
            <span>FAST LOOP (500ms) // 5-LAYER TAKAGI-SUGENO ANFIS ARCHITECTURE</span>
            <span>ONLINE GRADIENT DESCENT</span>
          </div>
          <div className="divide-y divide-[#222220]">
            {ANFIS_LAYERS.map((item) => (
              <div
                key={item.layer}
                className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0"
              >
                <div className="space-y-1.5 max-w-2xl min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono">
                    <span className="px-2 py-0.5 bg-[#ff5500] text-[#080808] text-[11px] sm:text-xs font-bold shrink-0">
                      {item.layer}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-[#f2efe9]">{item.title}</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#88857e] leading-relaxed">{item.desc}</p>
                </div>
                <div className="p-3 sm:p-3.5 bg-[#080808] border border-[#222220] font-mono text-[11px] sm:text-xs text-[#00e676] overflow-x-auto whitespace-nowrap">
                  {item.formula}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* GENETIC PROGRAMMING + DIGITAL TWIN */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <div className="panel-frame p-5 sm:p-6 space-y-4">
            <div className="font-mono text-[11px] sm:text-xs text-[#ff5500] uppercase">
              // SLOW LOOP (6s) · TREE-BASED GENETIC PROGRAMMING
            </div>
            <h2 className="font-display font-black text-2xl sm:text-3xl uppercase text-[#f2efe9]">
              SYMBOLIC HEURISTIC EVOLUTION
            </h2>
            <p className="text-xs sm:text-sm text-[#88857e] leading-relaxed">
              While ANFIS smoothly adapts rule weights, sudden non-linear bottlenecks (such as thread-pool exhaustion where CPU is low at 20% while latency spikes to 180ms) require structural formula discovery. The GP engine evolves syntax trees using:
            </p>
            <div className="p-3 sm:p-3.5 bg-[#080808] border border-[#222220] font-mono text-[11px] sm:text-xs space-y-1 overflow-x-auto">
              <div className="text-[#88857e]">TERMINALS: CPU, MEM, LAT, CONN, ERR, R ∈ [0.1, 2.0]</div>
              <div className="text-[#00e676]">
                PRIMITIVES: +, -, *, protected_div, min, max, exp, sqrt, sq
              </div>
            </div>
          </div>

          <div className="panel-frame p-5 sm:p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="font-mono text-[11px] sm:text-xs text-[#00e676] uppercase">
                // SAFETY GUARANTEE · ZERO LIVE TRAFFIC RISK
              </div>
              <h2 className="font-display font-black text-2xl sm:text-3xl uppercase text-[#f2efe9]">
                60-SECOND DIGITAL TWIN REPLAY BUFFER
              </h2>
              <p className="text-xs sm:text-sm text-[#88857e] leading-relaxed">
                Testing randomly mutated GP formulas directly on live HTTP requests would route user traffic to overloaded servers whenever a poorly mutated tree is evaluated. FuzzLoad evaluates all 36 candidate trees offline against the rolling 60-second telemetry replay buffer in &lt;25ms and only promotes verified elite formulas.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/dashboard" className="brutal-btn brutal-btn-primary w-full sm:w-auto">
                OPEN LIVE CONSOLE →
              </Link>
              <Link href="/playground" className="brutal-btn w-full sm:w-auto">
                OPEN HTTP PROBER →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
