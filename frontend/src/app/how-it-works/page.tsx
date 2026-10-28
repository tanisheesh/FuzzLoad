"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ANFIS_LAYERS = [
  {
    layer: "GATE 00",
    title: "McCULLOCH-PITTS BINARY CIRCUIT BREAKER & BPN XOR ANOMALY DETECTOR",
    formula: "y_MP = H( Σ w_i x_i - θ - ∞·I_inhib ) · XOR_BPN(CPU_hi, LAT_hi)",
    desc: "Evaluates hard binary excitatory/inhibitory thresholds before routing, while a 2-2-1 Backpropagation Network detects non-linear XOR mismatches (e.g., low CPU paired with high I/O tail latency).",
  },
  {
    layer: "LAYER 01",
    title: "GAUSSIAN & ASYMMETRIC LR-TYPE FUZZIFICATION NEURONS",
    formula: "μ(x) = 0.8·exp(-(x-c)²/2σ²) + 0.2·μ_LR(x; c, α_L, β_R)",
    desc: "Maps crisp normalized server telemetry x = [CPU, MEM, LAT, CONN] ∈ [0, 1] into smooth membership degrees (Low, Medium, High) combining symmetric Gaussian bells with asymmetric LR-Type fuzzy numbers and a 3×3 Max-Min Fuzzy Relation matrix.",
  },
  {
    layer: "LAYER 02",
    title: "PRODUCT T-NORM RULE FIRING GATED BY FLC-GA BITMASK",
    formula: "w_k(x) = m_k · μ_CPU(x_1) × μ_MEM(x_2) × μ_LAT(x_3) × μ_CONN(x_4)",
    desc: "Evaluates 12 Takagi-Sugeno fuzzy rules modulated by the 12-bit structural chromosome m_k ∈ {0, 1} evolved by the FLC-GA optimizer.",
  },
  {
    layer: "LAYER 03",
    title: "RULE NORMALIZATION (N LAYER)",
    formula: "w̄_k(x) = w_k(x) / Σ_{r=1}^{12} w_r(x)",
    desc: "Computes relative firing strengths across all active rules so total activation sums to unity.",
  },
  {
    layer: "LAYER 04",
    title: "ADAPTIVE TAKAGI-SUGENO CONSEQUENTS (MOMENTUM BPN + DELTA RULE)",
    formula: "Δw_t = β·Δw_{t-1} - η·(∂L_SLA / ∂w_k)",
    desc: "Evaluates first-order linear consequent polynomials per rule. Consequent parameters (p, q, r, s, b) and premise centers (c, σ) adapt online every 500ms via Momentum Backpropagation and Widrow-Hoff Delta Rule updates.",
  },
  {
    layer: "LAYER 05",
    title: "DUAL DEFUZZIFICATION (TAKAGI-SUGENO + MAMDANI CENTROID)",
    formula: "S_TS = 1 + 99·σ(Σ w̄_k f_k)  |  z*_COG = (∫ μ(z)·z dz) / (∫ μ(z) dz)",
    desc: "Computes both the differentiable Takagi-Sugeno crisp capacity score and the Mamdani Centroid (Center of Gravity) defuzzified score in [1, 100].",
  },
];

const SUBSYSTEM_SPECS = [
  {
    tag: "SUBSYSTEM A // UNSUPERVISED REGIME CLUSTERING",
    title: "ADAPTIVE RESONANCE THEORY (ART1 & ART2)",
    eq: "||x ∩ w_j|| / ||x|| ≥ ρ_1   |   (x · w_j) / (||x|| ||w_j||) ≥ ρ_2",
    body: "ART1 classifies 4-bit binary server fault signatures [CPU_HI, MEM_HI, IO_LAG, ERR_HI] using bitwise intersection and vigilance matching. ART2 clusters continuous 4D cluster telemetry vectors into operational regimes using attentional/orienting subsystems and Delta Rule prototype updates.",
  },
  {
    tag: "SUBSYSTEM B // ASSOCIATIVE POLICY MEMORY",
    title: "EXPONENTIAL BAM (AUTOCORRELATOR & HETEROCORRELATOR)",
    eq: "Y = Σ_{k=1}^{P} α_k · b^{-γ ||X - X^{(k)}||²} Y^{(k)}",
    body: "Stores real-coded pattern pairs associating cluster stress vectors X with pre-converged routing weight priors Y using Wang et al. multiple-training encoding weight factors (α_k) and bidirectional forward/backward associative recall.",
  },
  {
    tag: "SUBSYSTEM C // EVOLUTIONARY STRUCTURAL & SYMBOLIC CO-OPTIMIZER",
    title: "SYMBOLIC GP + BITWISE FLC-GA CHROMOSOME",
    eq: "C_child = (C_1 & M) | (C_2 & ~M)  →  Inversion(i, j)  →  Deletion(k)",
    body: "Co-evolves symbolic mathematical expression trees alongside a 12-bit binary chromosome that prunes redundant fuzzy rules (FLC-GA structural optimization) and initializes BPN premise weights using Bitwise Crossover, Inversion, Deletion, and Point Mutation on a 60s Digital Twin replay buffer.",
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
            HYBRID SOFT-COMPUTING ARCHITECTURE
          </h1>
          <p className="text-xs sm:text-base text-[#88857e] mt-3 max-w-3xl leading-relaxed">
            How FuzzLoad integrates a lock-free Go Reverse Proxy Data Plane with a 5-Layer Differentiable Neuro-Fuzzy (ANFIS) Fast Loop, ART1/ART2 Vigilance Clustering, Exponential BAM Associative Memory, and a Symbolic GP + Bitwise FLC-GA Evolutionary Slow Loop.
          </p>
        </div>

        {/* 5-LAYER ANFIS + M-P GATE BREAKDOWN */}
        <section className="panel-frame">
          <div className="panel-header">
            <span>FAST LOOP (500ms) // M-P GATE &amp; 5-LAYER TAKAGI-SUGENO ANFIS ARCHITECTURE</span>
            <span>MOMENTUM BPN + LR-FUZZY + CENTROID</span>
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

        {/* ART1/ART2, EXPONENTIAL BAM, AND SYMBOLIC GP + BITWISE FLC-GA */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {SUBSYSTEM_SPECS.map((sub) => (
            <div key={sub.title} className="panel-frame p-5 sm:p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="font-mono text-[10px] sm:text-[11px] text-[#ff5500] uppercase font-bold">
                  {sub.tag}
                </div>
                <h2 className="font-display font-black text-2xl sm:text-3xl uppercase text-[#f2efe9]">
                  {sub.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#88857e] leading-relaxed">{sub.body}</p>
              </div>
              <div className="p-3 bg-[#080808] border border-[#222220] font-mono text-[11px] text-[#00e676] overflow-x-auto whitespace-nowrap">
                {sub.eq}
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <div className="panel-frame p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-[#00e676] uppercase font-bold">
              // INTERACTIVE VERIFICATION
            </div>
            <p className="text-xs sm:text-sm text-[#88857e] mt-1">
              Inspect all subsystems running live at 2Hz and inject synthetic faults in the telemetry console.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/dashboard" className="brutal-btn brutal-btn-primary w-full sm:w-auto">
              OPEN LIVE CONSOLE →
            </Link>
            <Link href="/playground" className="brutal-btn w-full sm:w-auto">
              OPEN HTTP PROBER →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
