"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Brain,
  Cpu,
  Flame,
  GitBranch,
  Gauge,
  Layers,
  Network,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
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
  { id: "fuzzload", label: "FuzzLoad (GP + ANFIS)", badge: "AI Hybrid" },
  { id: "anfis_only", label: "ANFIS Neuro-Fuzzy Only", badge: "5-Layer NN" },
  { id: "weighted_round_robin", label: "Weighted Round Robin", badge: "Static Cap" },
  { id: "least_connections", label: "Least Connections", badge: "Heuristic" },
  { id: "round_robin", label: "Round Robin", badge: "Baseline" },
];

const TRAFFIC_PROFILES = [
  { id: "sine_wave", label: "Sine Wave Workload" },
  { id: "steady", label: "Steady Load" },
  { id: "flash_crowd", label: "Flash Crowd Spike" },
  { id: "chaos_burst", label: "Chaos Burst" },
];

function ASTTreeVisualizer({ node, depth = 0 }: { node: GPASTNode; depth?: number }) {
  const badgeColor =
    node.type === "operator"
      ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-200"
      : node.type === "variable"
      ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
      : "bg-amber-500/20 border-amber-400/50 text-amber-200";

  return (
    <div className="flex flex-col items-center">
      <div
        className={`px-2.5 py-1 rounded-md border text-xs font-mono font-semibold shadow-sm ${badgeColor}`}
      >
        {node.label}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="flex items-start gap-3 mt-3 pt-2 border-t border-slate-700/80 relative">
          {node.children.map((child, idx) => (
            <ASTTreeVisualizer key={`${child.label}-${idx}-${depth}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FuzzLoadDashboard() {
  const [state, setState] = useState<FuzzLoadClusterState>(() => createInitialFallbackState());
  const [backendLive, setBackendLive] = useState<boolean>(false);
  const [selectedFeature, setSelectedFeature] = useState<"cpu" | "latency" | "memory" | "connections">("cpu");
  const [isPaused, setIsPaused] = useState<boolean>(false);

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
      } catch {
        // Fallback already updated
      }
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
      } catch {
        // Fallback already updated
      }
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
      } catch {
        // Handled locally
      }
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
      } catch {
        // Handled locally
      }
    }
  };

  const p95SavingPct = Math.round(
    ((state.summary.round_robin_p95_ms - state.summary.fuzzload_p95_ms) /
      Math.max(1, state.summary.round_robin_p95_ms)) *
      100
  );

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 pb-16">
      {/* Top Header & Control Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#07090e]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold tracking-tight text-white">FuzzLoad</h1>
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Go Proxy + ANFIS + GP
                </span>
                <span
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                    backendLive
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-violet-500/15 text-violet-300 border-violet-500/30"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  {backendLive ? "Control Plane Connected" : "Digital Twin Telemetry Active"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Adaptive Web Server Load Balancing Using Genetic Programming &amp; 5-Layer Neuro-Fuzzy Control
              </p>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs text-slate-400">Policy:</span>
              <select
                aria-label="Routing Policy"
                value={state.algorithm}
                onChange={(e) => handleAlgorithmChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              >
                {ALGORITHMS.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-slate-400">Workload:</span>
              <select
                aria-label="Traffic Profile"
                value={state.traffic_profile}
                onChange={(e) => handleTrafficChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              >
                {TRAFFIC_PROFILES.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleEvolveGP}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Evolve GP (+5 Gen)
            </button>

            <button
              onClick={() => setIsPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {isPaused ? "Resume" : "Live 2Hz"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Top KPI Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-xl bg-slate-900/70 border border-slate-800/90 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Cluster Traffic Rate</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{state.current_rps} RPS</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={120}
                max={1000}
                step={20}
                value={state.base_rps}
                onChange={(e) => handleTrafficChange(state.traffic_profile, Number(e.target.value))}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-400">{state.base_rps}</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800/90 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Active P95 Tail Latency</span>
              <Gauge className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {state.summary.active_p95_ms.toFixed(1)} ms
            </div>
            <div className="mt-1 text-xs text-emerald-400 font-medium">
              {p95SavingPct > 0 ? `↓ ${p95SavingPct}% lower than Round Robin` : "Baseline comparison active"}
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800/90 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>ANFIS Neuro-Fuzzy Loop</span>
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">Epoch #{state.anfis.epoch}</div>
            <div className="mt-1 text-xs text-slate-400 font-mono">
              Online MSE Loss: <span className="text-violet-300">{state.anfis.current_loss.toFixed(4)}</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800/90 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Genetic Programming</span>
              <GitBranch className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">Gen #{state.gp.generation}</div>
            <div className="mt-1 text-xs text-slate-400 font-mono">
              Elite Fitness: <span className="text-indigo-300">{(state.gp.best_fitness * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800/90 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Jain&apos;s Fairness Index</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {state.summary.jains_fairness.toFixed(3)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Capacity-normalized load balance
            </div>
          </div>
        </section>

        {/* Live Heterogeneous Server Cluster Topology & Chaos Fault Injection */}
        <section className="rounded-2xl bg-slate-900/60 border border-slate-800/90 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                Heterogeneous Worker Cluster &amp; Real-Time Routing Weights
              </h2>
              <p className="text-xs text-slate-400">
                Inject synthetic faults on any server node below to watch the 5-Layer ANFIS + GP controller drain traffic in &lt;1.5 seconds.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Hybrid Blending: <span className="text-indigo-300">λ = {state.blending_lambda} ANFIS</span> +{" "}
              <span className="text-emerald-300">{(1 - state.blending_lambda).toFixed(2)} GP</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {state.nodes.map((node) => {
              const weightPct = Math.round(node.routing_weight * 100);
              const isDegraded = node.status === "degraded";
              const isOffline = node.status === "offline";
              const borderClass = isOffline
                ? "border-rose-500/60 bg-rose-950/15"
                : isDegraded
                ? "border-amber-500/60 bg-amber-950/15"
                : "border-slate-800 bg-slate-950/60";

              return (
                <div
                  key={node.node_id}
                  className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${borderClass}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white">{node.name}</h3>
                        <span className="text-[11px] font-mono text-slate-400">
                          127.0.0.1:{node.port} · {node.capacity_cores} vCPU · {node.memory_gb}GB
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          isOffline
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : isDegraded
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>

                    {/* Dynamic Routing Weight Bar */}
                    <div className="mt-3.5">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 font-medium">Routing Share (P_i)</span>
                        <span className="font-mono font-bold text-indigo-300 text-sm">{weightPct}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                          style={{ width: `${Math.min(100, weightPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Node Telemetry Metrics */}
                    <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-slate-800/80 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">CPU / RAM</span>
                        <span className="font-mono font-semibold text-slate-200">
                          {Math.round(node.cpu_usage * 100)}% / {Math.round(node.mem_usage * 100)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">P95 Latency</span>
                        <span
                          className={`font-mono font-semibold ${
                            node.p95_latency_ms > 90 ? "text-amber-300" : "text-emerald-300"
                          }`}
                        >
                          {node.p95_latency_ms.toFixed(1)} ms
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">ANFIS / GP Score</span>
                        <span className="font-mono text-indigo-300">
                          {node.anfis_score.toFixed(0)} / {node.gp_score.toFixed(0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Active Conns</span>
                        <span className="font-mono text-slate-200">{node.active_connections}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chaos Engineering Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" /> Chaos Fault Injection
                      </span>
                      {(node.chaos.cpu_spike || node.chaos.io_lag || node.chaos.mem_leak || node.chaos.offline) && (
                        <button
                          onClick={() => handleChaosToggle(node.node_id, "clear_all", true)}
                          className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() =>
                          handleChaosToggle(node.node_id, "cpu_spike", !node.chaos.cpu_spike)
                        }
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition cursor-pointer ${
                          node.chaos.cpu_spike
                            ? "bg-amber-500/25 border-amber-400 text-amber-200"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        CPU Spike
                      </button>
                      <button
                        onClick={() => handleChaosToggle(node.node_id, "io_lag", !node.chaos.io_lag)}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition cursor-pointer ${
                          node.chaos.io_lag
                            ? "bg-amber-500/25 border-amber-400 text-amber-200"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        I/O Lag
                      </button>
                      <button
                        onClick={() => handleChaosToggle(node.node_id, "offline", !node.chaos.offline)}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition cursor-pointer ${
                          node.chaos.offline
                            ? "bg-rose-500/25 border-rose-400 text-rose-200"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Offline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Real-Time Latency Telemetry & ANFIS Membership Curves */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 cols: Live P95 Tail Latency Comparison */}
          <div className="lg:col-span-7 rounded-2xl bg-slate-900/60 border border-slate-800/90 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Real-Time P95 Tail Latency: FuzzLoad vs Classical Algorithms
                </h2>
                <p className="text-xs text-slate-400">
                  Continuous comparison on live traffic trace (lower P95 latency is better)
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={state.metrics_history}>
                  <defs>
                    <linearGradient id="fuzzGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="round_robin_p95_ms"
                    name="Round Robin (Static)"
                    stroke="#f43f5e"
                    fill="none"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="least_conn_p95_ms"
                    name="Least Connections"
                    stroke="#f59e0b"
                    fill="none"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="fuzzload_p95_ms"
                    name="FuzzLoad (GP + ANFIS)"
                    stroke="#6366f1"
                    fill="url(#fuzzGrad)"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right 5 cols: 5-Layer ANFIS Gaussian Membership Curves */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" />
                  Layer-1 Fuzzy Gaussian Membership
                </h2>
                <p className="text-xs text-slate-400">
                  Trainable premise parameters (c, σ) tuned via online backprop
                </p>
              </div>
              <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(["cpu", "latency", "memory", "connections"] as const).map((feat) => (
                  <button
                    key={feat}
                    onClick={() => setSelectedFeature(feat)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase cursor-pointer ${
                      selectedFeature === feat
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {feat.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.anfis.curves[selectedFeature] || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="x" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="low"
                    name="μ_Low"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="medium"
                    name="μ_Medium"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="high"
                    name="μ_High"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Active Takagi-Sugeno Rules Firing */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Top Firing Takagi-Sugeno Fuzzy Rules (Layer 2 &amp; 3)
              </div>
              {state.anfis.rules.slice(0, 3).map((r) => (
                <div key={r.rule_id} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-300 truncate font-mono text-[11px]">{r.description}</span>
                  <span className="font-mono text-indigo-300 shrink-0">
                    w̄={r.firing_strength.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Genetic Programming Symbolic Tree Inspector & Evolution History */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* GP Expression Tree Visualizer */}
          <div className="lg:col-span-7 rounded-2xl bg-slate-900/60 border border-slate-800/90 p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-indigo-400" />
                    Genetic Programming (GP) Symbolic Expression Tree
                  </h2>
                  <p className="text-xs text-slate-400">
                    Evolved on 60-second Digital Twin Replay Buffer via Tournament Selection &amp; Subtree Crossover
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  Depth: {state.gp.tree_depth} · Nodes: {state.gp.tree_size}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-xs text-emerald-300 mb-4 overflow-x-auto">
                <span className="text-slate-500 select-none">Φ_GP(x) = </span>
                {state.gp.best_formula}
              </div>

              <div className="py-5 px-3 rounded-xl bg-slate-950/50 border border-slate-800/80 overflow-x-auto flex justify-center">
                <ASTTreeVisualizer node={state.gp.ast_tree} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
              <span>Terminals: CPU, MEM, LAT, CONN, ERR, R</span>
              <span>Primitives: +, -, *, protected_div, min, max, exp, sqrt, sq</span>
            </div>
          </div>

          {/* GP Fitness Evolution & Benchmark Comparison */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900/60 border border-slate-800/90 p-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Multi-Algorithm Benchmark Comparison
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              P95 &amp; P50 latency (ms) across all 5 policies under heterogeneous burst workload
            </p>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={state.benchmark} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} unit="ms" />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={135}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="p50_latency_ms" name="P50 Latency (ms)" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="p95_latency_ms" name="P95 Tail Latency (ms)" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1.5">Algorithm</th>
                    <th className="py-1.5 font-mono">P95</th>
                    <th className="py-1.5 font-mono">Err%</th>
                    <th className="py-1.5 font-mono">Fairness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {state.benchmark.map((row) => (
                    <tr
                      key={row.algorithm}
                      className={
                        row.algorithm === "fuzzload" ? "text-indigo-300 font-semibold" : "text-slate-300"
                      }
                    >
                      <td className="py-1.5 font-sans">{row.label}</td>
                      <td className="py-1.5">{row.p95_latency_ms}ms</td>
                      <td className="py-1.5">{row.error_rate_pct}%</td>
                      <td className="py-1.5">{row.jains_fairness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Architecture & Paradigm Summary Footer Card */}
        <section className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="font-bold text-white flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              1. Fuzzy Logic (Takagi-Sugeno)
            </div>
            <p className="text-slate-400 leading-relaxed">
              Maps noisy server metrics (CPU, Memory, Latency, Connections) into smooth Gaussian membership degrees (Low, Medium, High), preventing threshold oscillation.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="font-bold text-white flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-violet-400" />
              2. Neural Network (5-Layer ANFIS)
            </div>
            <p className="text-slate-400 leading-relaxed">
              Adapts Gaussian membership centers (c), widths (σ), and linear rule weights online every 500ms via analytical gradient descent to minimize SLA latency violations.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="font-bold text-white flex items-center gap-2 mb-1">
              <GitBranch className="w-4 h-4 text-indigo-400" />
              3. Genetic Programming (Symbolic GP)
            </div>
            <p className="text-slate-400 leading-relaxed">
              Evolves mathematical syntax trees via crossover and mutation over a 60-second Digital Twin replay buffer to discover optimal non-linear routing formulas.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
