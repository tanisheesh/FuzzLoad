"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Check,
  Copy,
  Globe,
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
  statusCode?: number;
  bytesReceived?: number;
  p50LatencyMs?: number;
  measuredLatencyMs: number;
  estimatedCpu: number;
  anfisScore: number;
  gpScore: number;
  assignedWeightPct: number;
  status: "ready" | "probed" | "slow" | "offline";
}

const INITIAL_UPSTREAMS: CustomUpstream[] = [
  {
    id: "up-1",
    name: "tanisheesh.in (Main Portfolio)",
    url: "https://tanisheesh.in",
    cores: 4,
    statusCode: 200,
    p50LatencyMs: 42.0,
    measuredLatencyMs: 54.2,
    estimatedCpu: 0.21,
    anfisScore: 92.4,
    gpScore: 94.1,
    assignedWeightPct: 48,
    status: "probed",
  },
  {
    id: "up-2",
    name: "reqly.tanisheesh.in (Reqly APM)",
    url: "https://reqly.tanisheesh.in",
    cores: 2,
    statusCode: 200,
    p50LatencyMs: 58.4,
    measuredLatencyMs: 74.8,
    estimatedCpu: 0.26,
    anfisScore: 84.6,
    gpScore: 86.2,
    assignedWeightPct: 31,
    status: "probed",
  },
  {
    id: "up-3",
    name: "diffhawk.tanisheesh.in (DiffHawk)",
    url: "https://diffhawk.tanisheesh.in",
    cores: 2,
    statusCode: 200,
    p50LatencyMs: 82.1,
    measuredLatencyMs: 108.5,
    estimatedCpu: 0.34,
    anfisScore: 76.1,
    gpScore: 77.8,
    assignedWeightPct: 21,
    status: "probed",
  },
];

export default function ProxyPlaygroundPage() {
  const [upstreams, setUpstreams] = useState<CustomUpstream[]>(INITIAL_UPSTREAMS);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCores, setNewCores] = useState(2);
  const [burstRequests, setBurstRequests] = useState(4);
  const [isProbing, setIsProbing] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [probeLogs, setProbeLogs] = useState<string[]>([
    "[FuzzLoad Live HTTP Prober] Ready to benchmark real production URLs via Server-Side HTTP Burst",
    "[Target #1] https://tanisheesh.in (4c) -> HTTP 200 | P95=54.2ms | ANFIS=92.4 | GP=94.1 -> Weight=48%",
    "[Target #2] https://reqly.tanisheesh.in (2c) -> HTTP 200 | P95=74.8ms | ANFIS=84.6 | GP=86.2 -> Weight=31%",
    "[Target #3] https://diffhawk.tanisheesh.in (2c) -> HTTP 200 | P95=108.5ms | ANFIS=76.1 | GP=77.8 -> Weight=21%",
  ]);

  const handleAddUpstream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const item: CustomUpstream = {
      id: `up-${Date.now()}`,
      name: newName.trim() || newUrl.replace(/^https?:\/\//, "").split("/")[0],
      url: newUrl.trim(),
      cores: newCores,
      statusCode: 200,
      p50LatencyMs: 45.0,
      measuredLatencyMs: 60.0,
      estimatedCpu: 0.25,
      anfisScore: 85.0,
      gpScore: 85.0,
      assignedWeightPct: Math.round(100 / (upstreams.length + 1)),
      status: "ready",
    };
    setUpstreams((prev) => [...prev, item]);
    setNewName("");
    setNewUrl("");
    setProbeLogs((prev) => [
      `[Added Live URL] ${item.url} — click "Fire Real HTTP Burst" to measure live latency & compute ANFIS+GP weights.`,
      ...prev.slice(0, 14),
    ]);
  };

  const handleRemove = (id: string) => {
    if (upstreams.length <= 1) return;
    setUpstreams((prev) => prev.filter((u) => u.id !== id));
  };

  const handleRunLiveBurst = async () => {
    setIsProbing(true);
    setProbeLogs((prev) => [
      `[Running Live Burst] Sending ${burstRequests} real HTTP GET requests per URL (${
        burstRequests * upstreams.length
      } total requests)...`,
      ...prev.slice(0, 14),
    ]);

    try {
      const res = await fetch("/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestsPerTarget: burstRequests,
          targets: upstreams.map((u) => ({
            id: u.id,
            name: u.name,
            url: u.url,
            cores: u.cores,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated: CustomUpstream[] = data.targets.map((t: any) => ({
          id: t.id,
          name: t.name,
          url: t.url,
          cores: t.cores,
          statusCode: t.statusCode,
          bytesReceived: t.bytesReceived,
          p50LatencyMs: t.p50LatencyMs,
          measuredLatencyMs: t.p95LatencyMs,
          estimatedCpu: t.estimatedCpu,
          anfisScore: t.anfisScore,
          gpScore: t.gpScore,
          assignedWeightPct: t.assignedWeightPct,
          status: t.status,
        }));
        setUpstreams(updated);
        const logEntries = updated.map(
          (u) =>
            `[HTTP ${u.statusCode || 200}] ${u.url} -> P50=${u.p50LatencyMs}ms, P95=${
              u.measuredLatencyMs
            }ms (${((u.bytesReceived || 0) / 1024).toFixed(1)} KB) => ANFIS=${u.anfisScore}, GP=${
              u.gpScore
            } => Routing Share = ${u.assignedWeightPct}%`
        );
        setProbeLogs((prev) => [...logEntries, ...prev.slice(0, 10)]);
      }
    } catch (err) {
      setProbeLogs((prev) => [
        `[Probe Error] ${err instanceof Error ? err.message : "Failed to probe"}`,
        ...prev,
      ]);
    } finally {
      setIsProbing(false);
    }
  };

  const cliCommand = `fuzzload start \\\n  --upstreams "${upstreams.map((u) => u.url).join(",")}" \\\n  --weights "${upstreams.map((u) => (u.assignedWeightPct / 100).toFixed(2)).join(",")}" \\\n  --policy fuzzload \\\n  --port 8080`;

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
              <Globe className="w-3.5 h-3.5" />
              Real Live Website &amp; API Load Tester (`/api/probe`)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Test Real Live URLs (`tanisheesh.in` or Any API)
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Pre-loaded with <code className="text-emerald-300">https://tanisheesh.in</code>,{" "}
              <code className="text-emerald-300">https://reqly.tanisheesh.in</code>, and{" "}
              <code className="text-emerald-300">https://diffhawk.tanisheesh.in</code>. Click{" "}
              <strong className="text-white">Fire Real HTTP Burst</strong> to execute real server-side HTTP requests, measure true P50/P95 latency, and compute live ANFIS + GP routing weights.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <span className="text-slate-400">Burst/URL:</span>
              <select
                value={burstRequests}
                onChange={(e) => setBurstRequests(Number(e.target.value))}
                className="bg-transparent font-mono font-bold text-white focus:outline-none"
              >
                <option value={3} className="bg-slate-900">3 reqs</option>
                <option value={5} className="bg-slate-900">5 reqs</option>
                <option value={8} className="bg-slate-900">8 reqs</option>
              </select>
            </div>

            <button
              onClick={handleRunLiveBurst}
              disabled={isProbing}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>{isProbing ? "Probing Live URLs..." : "Fire Real HTTP Burst"}</span>
            </button>
          </div>
        </div>

        {/* Add Custom Upstream Form */}
        <form
          onSubmit={handleAddUpstream}
          className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-4">
            <label className="block text-xs text-slate-400 mb-1">Website / Service Name</label>
            <input
              type="text"
              placeholder="e.g. NetPulse AI Live"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-xs text-slate-400 mb-1">Live HTTPS / HTTP URL to Test</label>
            <input
              type="url"
              required
              placeholder="https://netpulseai.tanisheesh.in"
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
              Add Live URL
            </button>
          </div>
        </form>

        {/* Registered Upstreams Table & ANFIS+GP Computed Weights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              Live Target Pool ({upstreams.length} Endpoints)
            </h2>

            {upstreams.map((u) => (
              <div
                key={u.id}
                className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{u.name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {u.cores} vCPU
                      </span>
                      {u.statusCode && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          HTTP {u.statusCode}
                        </span>
                      )}
                    </div>
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-indigo-400 hover:underline mt-0.5 block break-all"
                    >
                      {u.url} ↗
                    </a>
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
                      u.status === "slow" || u.status === "offline"
                        ? "bg-gradient-to-r from-amber-500 to-rose-500"
                        : "bg-gradient-to-r from-indigo-500 to-emerald-400"
                    }`}
                    style={{ width: `${u.assignedWeightPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/70 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">P50 Latency</span>
                    <span className="text-slate-200">{u.p50LatencyMs ?? u.measuredLatencyMs} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">P95 Latency</span>
                    <span className={u.measuredLatencyMs > 180 ? "text-amber-300" : "text-emerald-300"}>
                      {u.measuredLatencyMs} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">ANFIS Score</span>
                    <span className="text-violet-300">{u.anfisScore} / 100</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">GP Score</span>
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
                Use this command to run FuzzLoad as a reverse proxy in front of these exact URLs:
              </p>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                {cliCommand}
              </pre>
            </div>

            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Real HTTP Probe &amp; ANFIS/GP Scoring Log
              </h3>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2 max-h-64 overflow-y-auto">
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
