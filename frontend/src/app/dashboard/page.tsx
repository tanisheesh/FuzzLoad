"use client";

import React, { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createInitialFallbackState,
  evolveClientGP,
  FuzzLoadClusterState,
  GPASTNode,
  stepClientSimulation,
} from "@/lib/fuzzload-engine";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ALGORITHMS = [
  { id: "fuzzload", label: "FUZZLOAD (GP + ANFIS)" },
  { id: "anfis_only", label: "ANFIS NEURO-FUZZY ONLY" },
  { id: "weighted_round_robin", label: "WEIGHTED ROUND ROBIN" },
  { id: "least_connections", label: "LEAST CONNECTIONS" },
  { id: "round_robin", label: "ROUND ROBIN (STATIC)" },
];

const TRAFFIC_PROFILES = [
  { id: "sine_wave", label: "SINE WAVE WORKLOAD" },
  { id: "steady", label: "STEADY LOAD" },
  { id: "flash_crowd", label: "FLASH CROWD SPIKE" },
  { id: "chaos_burst", label: "CHAOS BURST" },
];

function ASTTreeVisualizer({ node, depth = 0 }: { node: GPASTNode; depth?: number }) {
  const borderStyle =
    node.type === "operator"
      ? "border-[#ff5500] text-[#ff5500] bg-[#151515]"
      : node.type === "variable"
      ? "border-[#00e676] text-[#00e676] bg-[#0b0b0b]"
      : "border-[#ffb300] text-[#ffb300] bg-[#0b0b0b]";

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className={`px-2 sm:px-2.5 py-1 border text-[11px] sm:text-xs font-mono font-bold ${borderStyle}`}>
        {node.label}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="flex items-start gap-2 sm:gap-3 mt-2.5 sm:mt-3 pt-2 border-t border-[#3a3834] relative">
          {node.children.map((child, idx) => (
            <ASTTreeVisualizer key={`${child.label}-${idx}-${depth}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LiveDemoDashboardPage() {
  const [state, setState] = useState<FuzzLoadClusterState>(() => createInitialFallbackState());
  const [backendLive, setBackendLive] = useState<boolean>(false);
  const [selectedFeature, setSelectedFeature] = useState<"cpu" | "latency" | "memory" | "connections">("cpu");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [exportBanner, setExportBanner] = useState<string | null>(null);

  const pollClusterState = useCallback(async () => {
    if (isPaused) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 650);
      const res = await fetch(`${API_BASE}/api/state`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data: FuzzLoadClusterState = await res.json();
        setState(data);
        setBackendLive(true);
        return;
      }
    } catch {
      setBackendLive(false);
    }
    setState((prev) => stepClientSimulation(prev));
  }, [isPaused]);

  useEffect(() => {
    const timer = setInterval(pollClusterState, 750);
    return () => clearInterval(timer);
  }, [pollClusterState]);

  const handleAlgorithmChange = async (algorithm: string) => {
    setState((prev) => stepClientSimulation({ ...prev, algorithm }));
    if (backendLive) {
      try {
        const res = await fetch(`${API_BASE}/api/config/algorithm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ algorithm }),
        });
        if (res.ok) setState(await res.json());
      } catch {}
    }
  };

  const handleTrafficChange = async (profile: string, baseRps?: number) => {
    const newRps = baseRps ?? state.base_rps;
    setState((prev) =>
      stepClientSimulation({ ...prev, traffic_profile: profile, base_rps: newRps })
    );
    if (backendLive) {
      try {
        const res = await fetch(`${API_BASE}/api/config/traffic`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, base_rps: newRps }),
        });
        if (res.ok) setState(await res.json());
      } catch {}
    }
  };

  const handleChaosToggle = async (
    nodeId: string,
    faultType: "cpu_spike" | "mem_leak" | "io_lag" | "offline" | "clear_all",
    enabled: boolean
  ) => {
    setState((prev) => {
      const nextNodes = prev.nodes.map((n) => {
        if (n.node_id !== nodeId) return n;
        if (faultType === "clear_all") {
          return {
            ...n,
            chaos: { cpu_spike: false, mem_leak: false, io_lag: false, offline: false },
          };
        }
        return {
          ...n,
          chaos: { ...n.chaos, [faultType]: enabled },
        };
      });
      return stepClientSimulation({ ...prev, nodes: nextNodes });
    });

    if (backendLive) {
      try {
        const res = await fetch(`${API_BASE}/api/chaos/inject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ node_id: nodeId, fault_type: faultType, enabled }),
        });
        if (res.ok) setState(await res.json());
      } catch {}
    }
  };

  const handleEvolveGP = async () => {
    setState((prev) => evolveClientGP(prev, 5));
    if (backendLive) {
      try {
        const res = await fetch(`${API_BASE}/api/gp/evolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generations: 5 }),
        });
        if (res.ok) setState(await res.json());
      } catch {}
    }
  };

  const handleExportCSV = () => {
    const header = "Algorithm,P50_ms,P95_ms,P99_ms,Throughput_RPS,Error_Pct,Jains_Fairness\n";
    const rows = state.benchmark
      .map(
        (b) =>
          `"${b.label}",${b.p50_latency_ms},${b.p95_latency_ms},${b.p99_latency_ms},${b.throughput_rps},${b.error_rate_pct},${b.jains_fairness}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuzzload-benchmark-gen${state.gp.generation}.csv`;
    a.click();
    setExportBanner("EXPORTED CSV");
    setTimeout(() => setExportBanner(null), 2500);
  };

  const handleCopyLatex = () => {
    const lines = [
      "\\begin{table}[htbp]",
      "\\centering",
      "\\caption{Comparative Performance Evaluation of FuzzLoad vs. Classical Load Balancing Policies}",
      "\\begin{tabular}{lccccc}",
      "\\hline",
      "\\textbf{Algorithm} & \\textbf{P50 (ms)} & \\textbf{P95 (ms)} & \\textbf{P99 (ms)} & \\textbf{Error (\\%)} & \\textbf{Jain's Index} \\\\",
      "\\hline",
      ...state.benchmark.map(
        (b) =>
          `${b.label} & ${b.p50_latency_ms} & ${b.p95_latency_ms} & ${b.p99_latency_ms} & ${b.error_rate_pct}\\% & ${b.jains_fairness} \\\\`
      ),
      "\\hline",
      "\\end{tabular}",
      "\\label{tab:fuzzload_results}",
      "\\end{table}",
    ].join("\n");
    navigator.clipboard.writeText(lines);
    setExportBanner("COPIED IEEE LATEX TABLE");
    setTimeout(() => setExportBanner(null), 2500);
  };

  const p95SavingPct = Math.round(
    ((state.summary.round_robin_p95_ms - state.summary.fuzzload_p95_ms) /
      Math.max(1, state.summary.round_robin_p95_ms)) *
      100
  );

  const degradedNodes = state.nodes.filter((n) => n.status !== "healthy");
  const topNode = [...state.nodes].sort((a, b) => b.routing_weight - a.routing_weight)[0];
  const sreNarrative =
    degradedNodes.length > 0
      ? `[FAULT DETECTED] ${degradedNodes
          .map((n) => `${n.name} P95=${n.p95_latency_ms.toFixed(0)}ms`)
          .join(", ")}. ANFIS Rule #6 & #12 triggered online gradient step -> drained faulty node weight to ${(
          degradedNodes[0].routing_weight * 100
        ).toFixed(1)}% and routed ${Math.round(topNode.routing_weight * 100)}% load to ${topNode.name}.`
      : `[NOMINAL] All 4 heterogeneous nodes within SLA at ${state.current_rps} RPS. ${
          topNode.name
        } carries ${Math.round(topNode.routing_weight * 100)}% share via ANFIS Epoch #${
          state.anfis.epoch
        } + GP Gen #${state.gp.generation}. Cluster P95 = ${state.summary.active_p95_ms.toFixed(
          1
        )}ms (-${p95SavingPct}% vs Round Robin).`;

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />

      {/* COMMAND BAR */}
      <div className="border-b border-[#222220] bg-[#0b0b0b]">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 border border-[#00e676] text-[#00e676] text-[10px] sm:text-[11px] font-bold">
              ● {backendLive ? "DAEMON: CONNECTED (:8000)" : "ENGINE: DIGITAL TWIN (500ms)"}
            </span>
            {exportBanner && (
              <span className="px-2.5 py-1 bg-[#ff5500] text-[#080808] font-bold text-[10px] sm:text-[11px]">
                {exportBanner}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <div className="col-span-2 sm:col-span-1 flex items-center border border-[#3a3834] bg-[#111111] px-2.5 py-1.5 min-w-0">
              <span className="text-[#88857e] mr-2 shrink-0 text-[11px]">POLICY:</span>
              <select
                aria-label="Routing Policy"
                value={state.algorithm}
                onChange={(e) => handleAlgorithmChange(e.target.value)}
                className="bg-transparent text-[#f2efe9] font-bold text-[11px] sm:text-xs focus:outline-none cursor-pointer w-full truncate"
              >
                {ALGORITHMS.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#0e0e0e] text-[#f2efe9]">
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center border border-[#3a3834] bg-[#111111] px-2.5 py-1.5 min-w-0">
              <span className="text-[#88857e] mr-2 shrink-0 text-[11px]">LOAD:</span>
              <select
                aria-label="Traffic Profile"
                value={state.traffic_profile}
                onChange={(e) => handleTrafficChange(e.target.value)}
                className="bg-transparent text-[#f2efe9] font-bold text-[11px] sm:text-xs focus:outline-none cursor-pointer w-full truncate"
              >
                {TRAFFIC_PROFILES.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0e0e0e] text-[#f2efe9]">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleEvolveGP}
              className="col-span-2 sm:col-span-1 brutal-btn brutal-btn-primary !py-1.5 !px-3"
            >
              + EVOLVE GP (5 GEN)
            </button>
            <button onClick={handleExportCSV} className="brutal-btn !py-1.5 !px-3">
              CSV
            </button>
            <button onClick={handleCopyLatex} className="brutal-btn !py-1.5 !px-3">
              LATEX
            </button>
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="col-span-2 sm:col-span-1 brutal-btn !py-1.5 !px-3"
            >
              {isPaused ? "▶ RESUME" : "❚❚ PAUSE"}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-5 sm:pt-6 space-y-5 sm:space-y-6">
        {/* TELEMETRY NARRATOR */}
        <div
          className={`border p-3 sm:p-3.5 font-mono text-[11px] sm:text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 ${
            degradedNodes.length > 0
              ? "border-[#ffb300] bg-[#ffb300]/10 text-[#ffb300]"
              : "border-[#222220] bg-[#0e0e0e] text-[#f2efe9]"
          }`}
        >
          <span className="leading-relaxed break-words">{sreNarrative}</span>
          <span className="text-[#88857e] shrink-0 text-[10px] sm:text-xs">TICK #{state.tick}</span>
        </div>

        {/* 5 KPI BLOCKS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 border border-[#222220] bg-[#0e0e0e] divide-y sm:divide-y-0 sm:divide-x divide-[#222220]">
          <div className="p-4">
            <div className="font-mono text-[10px] text-[#88857e] uppercase">INGRESS TRAFFIC</div>
            <div className="font-display font-black text-3xl sm:text-4xl text-[#f2efe9] mt-1">
              {state.current_rps} RPS
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                aria-label="Base Traffic RPS"
                min={120}
                max={1000}
                step={20}
                value={state.base_rps}
                onChange={(e) => handleTrafficChange(state.traffic_profile, Number(e.target.value))}
                className="w-full accent-[#ff5500] cursor-pointer"
              />
              <span className="font-mono text-[10px] text-[#88857e]">{state.base_rps}</span>
            </div>
          </div>

          <div className="p-4">
            <div className="font-mono text-[10px] text-[#88857e] uppercase">CLUSTER P95 LATENCY</div>
            <div className="font-display font-black text-3xl sm:text-4xl text-[#00e676] mt-1">
              {state.summary.active_p95_ms.toFixed(1)} ms
            </div>
            <div className="font-mono text-[11px] text-[#88857e] mt-1">
              {p95SavingPct > 0 ? `-${p95SavingPct}% VS ROUND ROBIN` : "BASELINE ACTIVE"}
            </div>
          </div>

          <div className="p-4">
            <div className="font-mono text-[10px] text-[#88857e] uppercase">ANFIS FAST LOOP</div>
            <div className="font-display font-black text-3xl sm:text-4xl text-[#f2efe9] mt-1">
              EPOCH #{state.anfis.epoch}
            </div>
            <div className="font-mono text-[11px] text-[#ff5500] mt-1">
              MSE LOSS: {state.anfis.current_loss.toFixed(4)}
            </div>
          </div>

          <div className="p-4">
            <div className="font-mono text-[10px] text-[#88857e] uppercase">GP SYMBOLIC LOOP</div>
            <div className="font-display font-black text-3xl sm:text-4xl text-[#f2efe9] mt-1">
              GEN #{state.gp.generation}
            </div>
            <div className="font-mono text-[11px] text-[#00e676] mt-1">
              FITNESS: {(state.gp.best_fitness * 100).toFixed(1)}%
            </div>
          </div>

          <div className="p-4 sm:col-span-2 lg:col-span-1">
            <div className="font-mono text-[10px] text-[#88857e] uppercase">JAIN&apos;S FAIRNESS</div>
            <div className="font-display font-black text-3xl sm:text-4xl text-[#f2efe9] mt-1">
              {state.summary.jains_fairness.toFixed(3)}
            </div>
            <div className="font-mono text-[11px] text-[#88857e] mt-1">
              CAPACITY-WEIGHTED INDEX
            </div>
          </div>
        </section>

        {/* 4 HETEROGENEOUS SERVER NODES + CHAOS MATRIX */}
        <section className="panel-frame">
          <div className="panel-header">
            <span>HETEROGENEOUS WORKER POOL // CHAOS FAULT INJECTION MATRIX</span>
            <span>BLENDING: λ={state.blending_lambda} ANFIS + {(1 - state.blending_lambda).toFixed(2)} GP</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#222220]">
            {state.nodes.map((node) => {
              const weightPct = Math.round(node.routing_weight * 100);
              const isDegraded = node.status === "degraded";
              const isOffline = node.status === "offline";

              return (
                <div key={node.node_id} className="p-4 sm:p-5 flex flex-col justify-between bg-[#0e0e0e] min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-xs sm:text-sm text-[#f2efe9] truncate">
                          {node.name}
                        </div>
                        <div className="font-mono text-[10px] sm:text-[11px] text-[#88857e]">
                          :{node.port} · {node.capacity_cores}vCPU · {node.memory_gb}GB
                        </div>
                      </div>
                      <span
                        className={`font-mono text-[10px] uppercase px-2 py-0.5 border font-bold shrink-0 ${
                          isOffline
                            ? "border-[#ff2a2a] text-[#ff2a2a]"
                            : isDegraded
                            ? "border-[#ffb300] text-[#ffb300]"
                            : "border-[#00e676] text-[#00e676]"
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>

                    <div className="my-3.5 sm:my-4">
                      <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                        <span className="text-[#88857e]">ROUTING SHARE (P_i)</span>
                        <span className="text-base sm:text-lg font-bold text-[#ff5500]">{weightPct}%</span>
                      </div>
                      <div className="w-full h-3 bg-[#1a1a18] border border-[#222220]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isOffline
                              ? "bg-[#ff2a2a]"
                              : isDegraded
                              ? "bg-[#ffb300]"
                              : "bg-[#ff5500]"
                          }`}
                          style={{ width: `${Math.min(100, weightPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#222220] font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-[#88857e] block">CPU / MEM</span>
                        <span className="text-[#f2efe9] font-bold">
                          {Math.round(node.cpu_usage * 100)}% / {Math.round(node.mem_usage * 100)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#88857e] block">P95 LATENCY</span>
                        <span
                          className={
                            node.p95_latency_ms > 90
                              ? "text-[#ffb300] font-bold"
                              : "text-[#00e676] font-bold"
                          }
                        >
                          {node.p95_latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#88857e] block">ANFIS / GP</span>
                        <span className="text-[#f2efe9]">
                          {node.anfis_score.toFixed(0)} / {node.gp_score.toFixed(0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#88857e] block">ACTIVE CONNS</span>
                        <span className="text-[#f2efe9]">{node.active_connections}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-5 pt-3 border-t border-[#222220] font-mono">
                    <div className="flex items-center justify-between text-[10px] text-[#88857e] mb-2">
                      <span>INJECT FAULT:</span>
                      {(node.chaos.cpu_spike || node.chaos.io_lag || node.chaos.offline) && (
                        <button
                          onClick={() => handleChaosToggle(node.node_id, "clear_all", true)}
                          className="text-[#ff5500] hover:underline cursor-pointer"
                        >
                          [RESET]
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() =>
                          handleChaosToggle(node.node_id, "cpu_spike", !node.chaos.cpu_spike)
                        }
                        className={`py-2 text-[10px] font-bold border cursor-pointer ${
                          node.chaos.cpu_spike
                            ? "bg-[#ffb300] text-[#080808] border-[#ffb300]"
                            : "bg-[#151515] text-[#88857e] border-[#222220] hover:text-[#f2efe9]"
                        }`}
                      >
                        CPU SPIKE
                      </button>
                      <button
                        onClick={() => handleChaosToggle(node.node_id, "io_lag", !node.chaos.io_lag)}
                        className={`py-2 text-[10px] font-bold border cursor-pointer ${
                          node.chaos.io_lag
                            ? "bg-[#ffb300] text-[#080808] border-[#ffb300]"
                            : "bg-[#151515] text-[#88857e] border-[#222220] hover:text-[#f2efe9]"
                        }`}
                      >
                        I/O LAG
                      </button>
                      <button
                        onClick={() =>
                          handleChaosToggle(node.node_id, "offline", !node.chaos.offline)
                        }
                        className={`py-2 text-[10px] font-bold border cursor-pointer ${
                          node.chaos.offline
                            ? "bg-[#ff2a2a] text-[#f2efe9] border-[#ff2a2a]"
                            : "bg-[#151515] text-[#88857e] border-[#222220] hover:text-[#f2efe9]"
                        }`}
                      >
                        KILL NODE
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CHARTS ROW 1: P95 LATENCY + ANFIS GAUSSIAN CURVES */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-7 panel-frame">
            <div className="panel-header">
              <span>REALTIME P95 TAIL LATENCY (ms) // FUZZLOAD VS STATIC BASELINES</span>
              <span>WINDOW: 45 TICKS</span>
            </div>
            <div className="p-3 sm:p-5 h-64 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={state.metrics_history}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#222220" />
                  <XAxis dataKey="timestamp" stroke="#88857e" fontSize={10} />
                  <YAxis stroke="#88857e" fontSize={10} width={38} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0b0b0b",
                      borderColor: "#3a3834",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: "11px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10px" }} />
                  <Area
                    type="monotone"
                    dataKey="round_robin_p95_ms"
                    name="ROUND ROBIN"
                    stroke="#ff2a2a"
                    fill="none"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="least_conn_p95_ms"
                    name="LEAST CONNS"
                    stroke="#ffb300"
                    fill="none"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="fuzzload_p95_ms"
                    name="FUZZLOAD (GP+ANFIS)"
                    stroke="#00e676"
                    fill="rgba(0, 230, 118, 0.12)"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 panel-frame flex flex-col justify-between">
            <div className="panel-header">
              <span>ANFIS LAYER-1 // GAUSSIAN MEMBERSHIP μ(x)</span>
              <div className="flex gap-1">
                {(["cpu", "latency", "memory", "connections"] as const).map((feat) => (
                  <button
                    key={feat}
                    onClick={() => setSelectedFeature(feat)}
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase cursor-pointer border ${
                      selectedFeature === feat
                        ? "bg-[#ff5500] text-[#080808] border-[#ff5500] font-bold"
                        : "bg-[#151515] text-[#88857e] border-[#222220]"
                    }`}
                  >
                    {feat.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 sm:p-4 h-52 sm:h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.anfis.curves[selectedFeature] || []}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#222220" />
                  <XAxis dataKey="x" stroke="#88857e" fontSize={10} />
                  <YAxis stroke="#88857e" fontSize={10} domain={[0, 1]} width={32} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0b0b0b",
                      borderColor: "#3a3834",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: "11px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10px" }} />
                  <Line type="monotone" dataKey="low" name="μ_LOW" stroke="#00e676" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="medium" name="μ_MED" stroke="#ffb300" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="high" name="μ_HIGH" stroke="#ff2a2a" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="p-3.5 sm:p-4 border-t border-[#222220] font-mono text-[11px] space-y-1.5">
              <div className="text-[10px] text-[#88857e] uppercase">
                ACTIVE TAKAGI-SUGENO RULE FIRING STRENGTHS (LAYER 2 &amp; 3)
              </div>
              {state.anfis.rules.slice(0, 3).map((r) => (
                <div key={r.rule_id} className="flex items-center justify-between gap-2">
                  <span className="text-[#f2efe9] truncate text-[10px] sm:text-[11px]">
                    {r.description}
                  </span>
                  <span className="text-[#ff5500] font-bold shrink-0">
                    w̄={r.firing_strength.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CHARTS ROW 2: GP AST TREE + 5-ALGORITHM BENCHMARK */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-7 panel-frame flex flex-col justify-between">
            <div className="panel-header">
              <span>GENETIC PROGRAMMING // EVOLVED SYMBOLIC SYNTAX TREE (AST)</span>
              <span>DEPTH: {state.gp.tree_depth} · NODES: {state.gp.tree_size}</span>
            </div>

            <div className="p-3.5 sm:p-5 space-y-4">
              <div className="p-3 border border-[#222220] bg-[#080808] font-mono text-[11px] sm:text-xs text-[#00e676] overflow-x-auto whitespace-nowrap">
                <span className="text-[#88857e]">Φ_GP(x) = </span>
                {state.gp.best_formula}
              </div>

              <div className="py-5 px-3 border border-[#222220] bg-[#0b0b0b] overflow-x-auto flex justify-start sm:justify-center">
                <ASTTreeVisualizer node={state.gp.ast_tree} />
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-[#222220] font-mono text-[10px] sm:text-[11px] text-[#88857e] flex flex-wrap justify-between gap-2">
              <span>
                FLC-GA RULE MASK:{" "}
                <strong className="text-[#ff5500]">
                  {state.gp.rule_mask_bitstring ?? "111101111101"}
                </strong>{" "}
                ({state.gp.last_operator ?? "INVERSION + BITWISE_XOVER"})
              </span>
              <span>OPS: +, -, *, DIV, MIN, MAX, EXP, SQRT, SQ</span>
            </div>
          </div>

          <div className="lg:col-span-5 panel-frame flex flex-col justify-between">
            <div className="panel-header">
              <span>COMPARATIVE BENCHMARK SUITE (5 POLICIES)</span>
              <span>480 RPS TRACE</span>
            </div>

            <div className="p-3 sm:p-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={state.benchmark} layout="vertical">
                  <CartesianGrid strokeDasharray="2 2" stroke="#222220" />
                  <XAxis type="number" stroke="#88857e" fontSize={10} />
                  <YAxis type="category" dataKey="label" stroke="#f2efe9" fontSize={9} width={115} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0b0b0b",
                      borderColor: "#3a3834",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="p50_latency_ms" name="P50 (ms)" fill="#88857e" />
                  <Bar dataKey="p95_latency_ms" name="P95 (ms)" fill="#ff5500" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-3.5 sm:p-4 border-t border-[#222220] overflow-x-auto">
              <table className="w-full min-w-[300px] text-left font-mono text-[11px] sm:text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#222220] text-[#88857e] text-[10px]">
                    <th className="py-1.5 pr-2">POLICY</th>
                    <th className="py-1.5 px-2">P95</th>
                    <th className="py-1.5 px-2">ERR%</th>
                    <th className="py-1.5 pl-2">FAIRNESS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222220]">
                  {state.benchmark.map((row) => (
                    <tr
                      key={row.algorithm}
                      className={
                        row.algorithm === "fuzzload" ? "text-[#00e676] font-bold" : "text-[#f2efe9]"
                      }
                    >
                      <td className="py-1.5 pr-2 whitespace-nowrap">{row.label}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{row.p95_latency_ms}ms</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{row.error_rate_pct}%</td>
                      <td className="py-1.5 pl-2 whitespace-nowrap">{row.jains_fairness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SOFT-COMPUTING SUBSYSTEM TELEMETRY: ART1/ART2 + EXPONENTIAL BAM + M-P GATE + LR-FUZZY */}
        <section className="panel-frame">
          <div className="panel-header">
            <span>HYBRID SOFT-COMPUTING SUBSYSTEMS // ART1 · ART2 · EXPONENTIAL BAM · FLC-GA · M-P GATE</span>
            <span>REALTIME TELEMETRY</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#222220] font-mono text-xs">
            <div className="p-4 space-y-1.5">
              <div className="text-[10px] text-[#ff5500] uppercase font-bold">
                [ART2] CONTINUOUS VIGILANCE CLUSTERING
              </div>
              <div className="text-[#f2efe9] font-bold truncate">
                {state.art_bam?.art2.regime_label ?? "REGIME_01 // BALANCED_STEADY"}
              </div>
              <div className="text-[11px] text-[#88857e]">
                SIMILARITY: <span className="text-[#00e676]">{state.art_bam?.art2.similarity ?? 0.964}</span> · VIGILANCE ρ={state.art_bam?.art2.vigilance ?? 0.86} (DELTA RULE)
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="text-[10px] text-[#ff5500] uppercase font-bold">
                [ART1] BINARY FAULT SIGNATURE &amp; M-P GATE
              </div>
              <div className="text-[#f2efe9] font-bold">
                BITS: [{state.art_bam?.art1.signature ?? "0000"}] · {state.art_bam?.art1.matched_category ?? "NOMINAL"}
              </div>
              <div className="text-[11px] text-[#88857e]">
                M-P CIRCUIT BREAKER: <span className="text-[#00e676]">OPEN</span> · BPN XOR DETECTOR: ACTIVE
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="text-[10px] text-[#ff5500] uppercase font-bold">
                [EXPONENTIAL BAM] HETEROCORRELATOR RECALL
              </div>
              <div className="text-[#f2efe9] font-bold">
                PRIOR: [{(state.art_bam?.bam_prior_weights ?? [0.44, 0.23, 0.24, 0.09]).join(", ")}]
              </div>
              <div className="text-[11px] text-[#88857e]">
                RESONANCE ENERGY: <span className="text-[#00e676]">{state.art_bam?.bam_resonance ?? 0.912}</span> · PAIRS: {state.art_bam?.bam_stored_pairs ?? 6}
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="text-[10px] text-[#ff5500] uppercase font-bold">
                [LR-FUZZY &amp; FLC-GA] DUAL DEFUZZIFICATION
              </div>
              <div className="text-[#f2efe9] font-bold">
                CENTROID: {state.anfis.centroid_defuzz_score ?? 76.4} · CHROM: {state.gp.rule_mask_bitstring ?? "111101111101"}
              </div>
              <div className="text-[11px] text-[#88857e]">
                MOMENTUM BPN β={state.anfis.momentum ?? 0.35} · MAX-MIN RELATION 3×3
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
