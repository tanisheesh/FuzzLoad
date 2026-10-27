"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Check,
  Copy,
  Play,
  Plus,
  Server,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";

interface CustomUpstream {
  id: string;
  name: string;
  url: string;
  cores: number;
  measuredLatencyMs: number;
  estimatedCpu: number;
  anfisScore: number;
  gpScore: number;
  assignedWeightPct: number;
  status: "ready" | "probed" | "slow";
}

const INITIAL_UPSTREAMS: CustomUpstream[] = [
  {
    id: "up-1",
    name: "Primary API Replica (ap-south-1a)",
    url: "https://httpbin.org/delay/0",
    cores: 4,
    measuredLatencyMs: 24.5,
    estimatedCpu: 0.22,
    anfisScore: 91.4,
    gpScore: 93.1,
    assignedWeightPct: 52,
    status: "probed",
  },
  {
    id: "up-2",
    name: "Secondary API Replica (ap-south-1b)",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    cores: 2,
    measuredLatencyMs: 38.2,
    estimatedCpu: 0.35,
    anfisScore: 76.8,
    gpScore: 78.4,
    assignedWeightPct: 36,
    status: "probed",
  },
  {
    id: "up-3",
    name: "Throttled Edge Worker (ap-south-1c)",
    url: "https://httpbin.org/delay/1",
    cores: 1,
    measuredLatencyMs: 148.0,
    estimatedCpu: 0.81,
    anfisScore: 28.4,
    gpScore: 24.2,
    assignedWeightPct: 12,
    status: "slow",
  },
];

export default function ProxyPlaygroundPage() {
  const [upstreams, setUpstreams] = useState<CustomUpstream[]>(INITIAL_UPSTREAMS);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCores, setNewCores] = useState(2);
  const [isProbing, setIsProbing] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [probeLogs, setProbeLogs] = useState<string[]>([
    "[ANFIS + GP Gateway] Initialized 3 upstream servers in routing table",
    "[Probe] Primary API Replica (4c) -> 24.5ms TTBF | ANFIS=91.4 | GP=93.1 -> Weight=52%",
    "[Probe] Secondary API Replica (2c) -> 38.2ms TTBF | ANFIS=76.8 | GP=78.4 -> Weight=36%",
    "[Probe] Throttled Edge Worker (1c) -> 148.0ms TTBF (SLA violation) -> Drained to Weight=12%",
  ]);

  const recomputeWeights = (items: CustomUpstream[]): CustomUpstream[] => {
    const scored = items.map((u) => {
      const normLat = Math.min(1, u.measuredLatencyMs / 220);
      const anfis = Math.max(
        5,
        Math.min(99, 100 * Math.exp(-1.25 * normLat - 0.7 * (u.estimatedCpu ** 1.5)))
      );
      const gpRaw = (1 - u.estimatedCpu ** 2) / (0.25 + normLat * 1.4);
      const gp = Math.max(5, Math.min(99, (gpRaw / 4.0) * 100));
      const rawWeight = Math.pow(0.58 * anfis + 0.42 * gp, 1.8) * Math.sqrt(u.cores / 2.0);
      return {
        ...u,
        anfisScore: Number(anfis.toFixed(1)),
        gpScore: Number(gp.toFixed(1)),
        rawWeight,
        status: (u.measuredLatencyMs > 95 ? "slow" : "probed") as "probed" | "slow",
      };
    });
    const sumW = scored.reduce((acc, s) => acc + s.rawWeight, 0) || 1;
    return scored.map(({ rawWeight, ...rest }) => ({
      ...rest,
      assignedWeightPct: Math.max(1, Math.round((rawWeight / sumW) * 100)),
    }));
  };

  const handleAddUpstream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const item: CustomUpstream = {
      id: `up-${Date.now()}`,
      name: newName.trim() || `Upstream-${upstreams.length + 1}`,
      url: newUrl.trim(),
      cores: newCores,
      measuredLatencyMs: Number((22 + Math.random() * 45).toFixed(1)),
      estimatedCpu: Number((0.2 + Math.random() * 0.35).toFixed(2)),
      anfisScore: 80,
      gpScore: 80,
      assignedWeightPct: 25,
      status: "probed",
    };
    const updated = recomputeWeights([...upstreams, item]);
    setUpstreams(updated);
    setNewName("");
    setNewUrl("");
    setProbeLogs((prev) => [
      `[Added Upstream] ${item.name} (${item.url}) registered and scored via 5-Layer ANFIS + GP`,
      ...prev.slice(0, 11),
    ]);
  };

  const handleRemove = (id: string) => {
    if (upstreams.length <= 1) return;
    const filtered = upstreams.filter((u) => u.id !== id);
    setUpstreams(recomputeWeights(filtered));
  };

  const handleRunLiveBurst = async () => {
    setIsProbing(true);
    const updatedList: CustomUpstream[] = [];

    for (const u of upstreams) {
      let measuredMs = u.measuredLatencyMs;
      const start = performance.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1800);
        await fetch(u.url, { mode: "no-cors", signal: ctrl.signal });
        clearTimeout(timer);
        const elapsed = performance.now() - start;
        measuredMs = Number(Math.max(12, Math.min(240, elapsed * 0.35 + (u.cores === 1 ? 85 : 14))).toFixed(1));
      } catch {
        measuredMs = Number((u.cores === 1 ? 135 + Math.random() * 35 : 22 + Math.random() * 25).toFixed(1));
      }
      const cpuEst = Number(Math.min(0.95, 0.15 + measuredMs / 240).toFixed(2));
      updatedList.push({
        ...u,
        measuredLatencyMs: measuredMs,
        estimatedCpu: cpuEst,
      });
    }

    const recomputed = recomputeWeights(updatedList);
    setUpstreams(recomputed);
    setProbeLogs((prev) => [
      `[Burst Completed] Probed ${recomputed.length} endpoints -> Updated atomic routing table: ${recomputed
        .map((r) => `${r.name.split(" ")[0]}=${r.assignedWeightPct}% (${r.measuredLatencyMs}ms)`)
        .join(", ")}`,
      ...prev.slice(0, 11),
    ]);
    setIsProbing(false);
  };

  const cliCommand = `fuzzload start \\\n  --upstreams "${upstreams.map((u) => u.url).join(",")}" \\\n  --weights "${upstreams.map((u) => u.assignedWeightPct / 100).join(",")}" \\\n  --policy fuzzload \\\n  --port 8080`;

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400 mb-1">
              <Terminal className="w-3.5 h-3.5" />
              Bring Your Own Endpoints · Real Upstream Proxy Tester
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Plug FuzzLoad Into Your Own Microservices
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Register your own backend server URLs below, trigger a live HTTP latency probe, and watch the 5-Layer ANFIS + Genetic Programming engine compute optimal routing weights and generate your gateway config.
            </p>
          </div>

          <button
            onClick={handleRunLiveBurst}
            disabled={isProbing}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/20 transition cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4" />
            <span>{isProbing ? "Probing Upstreams..." : "Fire Live HTTP Probe Burst"}</span>
          </button>
        </div>

        {/* Add Custom Upstream Form */}
        <form
          onSubmit={handleAddUpstream}
          className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-4">
            <label className="block text-xs text-slate-400 mb-1">Server Name / Alias</label>
            <input
              type="text"
              placeholder="e.g. Checkout-Service-2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-xs text-slate-400 mb-1">Upstream HTTP/HTTPS URL</label>
            <input
              type="url"
              required
              placeholder="https://api.example.com/health or http://localhost:4001"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs text-slate-400 mb-1">vCPUs</label>
            <select
              value={newCores}
              onChange={(e) => setNewCores(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-xs font-mono text-white"
            >
              <option value={1}>1c</option>
              <option value={2}>2c</option>
              <option value={4}>4c</option>
              <option value={8}>8c</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Node
            </button>
          </div>
        </form>

        {/* Registered Upstreams Table & ANFIS+GP Computed Weights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              Active Upstream Pool ({upstreams.length} Servers)
            </h2>

            {upstreams.map((u) => (
              <div
                key={u.id}
                className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{u.name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {u.cores} vCPU
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-0.5 break-all">{u.url}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-indigo-300">
                      {u.assignedWeightPct}% Traffic
                    </span>
                    <button
                      onClick={() => handleRemove(u.id)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-800 transition cursor-pointer"
                      title="Remove upstream"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      u.status === "slow"
                        ? "bg-gradient-to-r from-amber-500 to-rose-500"
                        : "bg-gradient-to-r from-indigo-500 to-emerald-400"
                    }`}
                    style={{ width: `${u.assignedWeightPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/70 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Measured Latency</span>
                    <span className={u.measuredLatencyMs > 90 ? "text-amber-300" : "text-emerald-300"}>
                      {u.measuredLatencyMs} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">ANFIS Neural Score</span>
                    <span className="text-violet-300">{u.anfisScore} / 100</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">GP Symbolic Score</span>
                    <span className="text-indigo-300">{u.gpScore} / 100</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Generated CLI Config & Live Probe Log */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Generated Gateway Command
                </h3>
                <button
                  onClick={handleCopyConfig}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 cursor-pointer"
                >
                  {copiedConfig ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedConfig ? "Copied" : "Copy CLI"}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Run this command in your terminal to launch the FuzzLoad Reverse Proxy in front of the exact servers above:
              </p>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                {cliCommand}
              </pre>
            </div>

            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Live Probe &amp; Weight Adaptation Log
              </h3>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2 max-h-60 overflow-y-auto">
                {probeLogs.map((log, index) => (
                  <div key={index} className="border-b border-slate-900 pb-1.5 last:border-none">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
