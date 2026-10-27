"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
    name: "Primary Edge Upstream (Fast)",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    cores: 4,
    statusCode: 200,
    p50LatencyMs: 28.4,
    measuredLatencyMs: 36.2,
    estimatedCpu: 0.19,
    anfisScore: 92.1,
    gpScore: 93.8,
    assignedWeightPct: 54,
    status: "probed",
  },
  {
    id: "up-2",
    name: "Secondary Compute Node",
    url: "https://httpbin.org/get",
    cores: 2,
    statusCode: 200,
    p50LatencyMs: 64.0,
    measuredLatencyMs: 82.5,
    estimatedCpu: 0.31,
    anfisScore: 79.4,
    gpScore: 81.0,
    assignedWeightPct: 35,
    status: "probed",
  },
  {
    id: "up-3",
    name: "Degraded / Delayed Worker",
    url: "https://httpbin.org/delay/1",
    cores: 1,
    statusCode: 200,
    p50LatencyMs: 310.0,
    measuredLatencyMs: 420.0,
    estimatedCpu: 0.84,
    anfisScore: 22.4,
    gpScore: 19.8,
    assignedWeightPct: 11,
    status: "slow",
  },
];

export default function ProxyPlaygroundPage() {
  const [upstreams, setUpstreams] = useState<CustomUpstream[]>(INITIAL_UPSTREAMS);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCores, setNewCores] = useState(2);
  const [burstRequests, setBurstRequests] = useState(3);
  const [isProbing, setIsProbing] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [probeLogs, setProbeLogs] = useState<string[]>([
    "[PROBER INIT] Paste any public HTTPS URL or API endpoint above and click '+ ADD TARGET' to include it in the pool.",
    "[READY] Click 'EXECUTE HTTP BURST' to fire real server-side requests via /api/probe and compute ANFIS + GP routing weights.",
  ]);

  const handleAddUpstream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const cleanUrl = newUrl.trim();
    const item: CustomUpstream = {
      id: `up-${Date.now()}`,
      name: newName.trim() || cleanUrl.replace(/^https?:\/\//, "").split("/")[0],
      url: cleanUrl,
      cores: newCores,
      statusCode: 200,
      p50LatencyMs: 40.0,
      measuredLatencyMs: 55.0,
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
      `[REGISTERED] ${item.url} (${item.cores}vCPU) added to upstream pool.`,
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
      `[PROBING] Firing ${burstRequests} concurrent HTTP GET requests per target (${
        burstRequests * upstreams.length
      } total)...`,
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
            }ms => ANFIS=${u.anfisScore}, GP=${u.gpScore} => SHARE=${u.assignedWeightPct}%`
        );
        setProbeLogs((prev) => [...logEntries, ...prev.slice(0, 10)]);
      }
    } catch (err) {
      setProbeLogs((prev) => [
        `[ERROR] ${err instanceof Error ? err.message : "Probe request failed"}`,
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
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">
        {/* HEADER */}
        <div className="border border-[#222220] bg-[#0e0e0e] p-5 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="font-mono text-[11px] sm:text-xs text-[#ff5500] uppercase tracking-widest mb-2">
              // REAL SERVER-SIDE HTTP BENCHMARK &amp; WEIGHT CALCULATOR
            </div>
            <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase text-[#f2efe9]">
              BENCHMARK ANY LIVE URL OR UPSTREAM API
            </h1>
            <p className="text-xs sm:text-sm text-[#88857e] mt-2 max-w-2xl leading-relaxed">
              Enter any live URL or API endpoint below. When you execute a probe burst, the server fires real concurrent HTTP GET requests, measures true P50/P95 response times, and computes exact 5-Layer ANFIS + Genetic Programming routing weights.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 font-mono">
            <div className="border border-[#3a3834] bg-[#151515] px-3 py-2.5 text-xs flex items-center justify-between">
              <span className="text-[#88857e] mr-2">BURST:</span>
              <select
                aria-label="Burst Requests Per URL"
                value={burstRequests}
                onChange={(e) => setBurstRequests(Number(e.target.value))}
                className="bg-transparent font-bold text-[#f2efe9] focus:outline-none cursor-pointer"
              >
                <option value={2} className="bg-[#0e0e0e]">2 REQS/URL</option>
                <option value={4} className="bg-[#0e0e0e]">4 REQS/URL</option>
                <option value={6} className="bg-[#0e0e0e]">6 REQS/URL</option>
              </select>
            </div>

            <button
              onClick={handleRunLiveBurst}
              disabled={isProbing}
              className="brutal-btn brutal-btn-primary w-full sm:w-auto"
            >
              {isProbing ? "PROBING UPSTREAMS..." : "▶ EXECUTE HTTP BURST"}
            </button>
          </div>
        </div>

        {/* ADD TARGET FORM */}
        <form
          onSubmit={handleAddUpstream}
          className="panel-frame p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end font-mono"
        >
          <div className="sm:col-span-3">
            <label className="block text-[10px] text-[#88857e] uppercase mb-1">
              NODE ALIAS (OPTIONAL)
            </label>
            <input
              type="text"
              placeholder="e.g. prod-api-east"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-[#080808] border border-[#3a3834] px-3 py-2.5 text-xs text-[#f2efe9] focus:outline-none focus:border-[#ff5500]"
            />
          </div>
          <div className="sm:col-span-6">
            <label className="block text-[10px] text-[#88857e] uppercase mb-1">
              TARGET HTTPS / HTTP URL TO PROBE
            </label>
            <input
              type="url"
              required
              placeholder="https://your-domain-or-api.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full bg-[#080808] border border-[#3a3834] px-3 py-2.5 text-xs text-[#f2efe9] focus:outline-none focus:border-[#ff5500]"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-[10px] text-[#88857e] uppercase mb-1">CORES</label>
            <select
              aria-label="CPU Cores"
              value={newCores}
              onChange={(e) => setNewCores(Number(e.target.value))}
              className="w-full bg-[#080808] border border-[#3a3834] px-2 py-2.5 text-xs text-[#f2efe9]"
            >
              <option value={1}>1c</option>
              <option value={2}>2c</option>
              <option value={4}>4c</option>
              <option value={8}>8c</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="brutal-btn w-full">
              + ADD TARGET
            </button>
          </div>
        </form>

        {/* TARGET POOL + LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-7 space-y-3 min-w-0">
            {upstreams.map((u) => (
              <div key={u.id} className="panel-frame p-4 sm:p-5 space-y-3 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-[#f2efe9]">{u.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 border border-[#3a3834] text-[#88857e]">
                        {u.cores}vCPU
                      </span>
                      {u.statusCode && (
                        <span className="text-[10px] px-1.5 py-0.5 border border-[#00e676] text-[#00e676]">
                          HTTP {u.statusCode}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] sm:text-xs text-[#88857e] mt-1 break-all">
                      {u.url}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0">
                    <span className="text-base sm:text-lg font-bold text-[#ff5500]">
                      {u.assignedWeightPct}% SHARE
                    </span>
                    <button
                      onClick={() => handleRemove(u.id)}
                      className="px-2 py-1 border border-[#3a3834] text-[10px] text-[#88857e] hover:border-[#ff2a2a] hover:text-[#ff2a2a] cursor-pointer"
                    >
                      DEL
                    </button>
                  </div>
                </div>

                <div className="w-full h-2.5 bg-[#151515] border border-[#222220]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      u.status === "slow" || u.status === "offline"
                        ? "bg-[#ffb300]"
                        : "bg-[#00e676]"
                    }`}
                    style={{ width: `${u.assignedWeightPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#222220] text-xs">
                  <div>
                    <span className="text-[10px] text-[#88857e] block">P50 LATENCY</span>
                    <span className="text-[#f2efe9] font-bold">
                      {u.p50LatencyMs ?? u.measuredLatencyMs} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#88857e] block">P95 LATENCY</span>
                    <span
                      className={
                        u.measuredLatencyMs > 200
                          ? "text-[#ffb300] font-bold"
                          : "text-[#00e676] font-bold"
                      }
                    >
                      {u.measuredLatencyMs} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#88857e] block">ANFIS SCORE</span>
                    <span className="text-[#f2efe9]">{u.anfisScore} / 100</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#88857e] block">GP SCORE</span>
                    <span className="text-[#f2efe9]">{u.gpScore} / 100</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-5 space-y-5 sm:space-y-6 min-w-0">
            <div className="panel-frame">
              <div className="panel-header">
                <span>GENERATED GATEWAY CLI CONFIG</span>
                <button
                  onClick={handleCopyConfig}
                  className="text-[#ff5500] hover:underline font-bold cursor-pointer"
                >
                  {copiedConfig ? "[COPIED]" : "[COPY]"}
                </button>
              </div>
              <div className="p-3.5 sm:p-4">
                <pre className="p-3 bg-[#080808] border border-[#222220] font-mono text-[11px] sm:text-xs text-[#00e676] overflow-x-auto leading-relaxed">
                  {cliCommand}
                </pre>
              </div>
            </div>

            <div className="panel-frame">
              <div className="panel-header">
                <span>SERVER-SIDE HTTP PROBE TELEMETRY LOG</span>
                <span>/api/probe</span>
              </div>
              <div className="p-3.5 sm:p-4 font-mono text-[11px] text-[#88857e] space-y-2 max-h-72 overflow-y-auto break-words">
                {probeLogs.map((log, index) => (
                  <div
                    key={index}
                    className="border-b border-[#222220] pb-1.5 last:border-none text-[#f2efe9]"
                  >
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
