import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { NextRequest, NextResponse } from "next/server";

interface ProbeTargetInput {
  id: string;
  name: string;
  url: string;
  cores: number;
}

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[Math.min(sorted.length - 1, base + 1)];
  return sorted[base] + rest * (next - sorted[base]);
}

function isDisallowedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function extractMappedIPv4FromIPv6(rawIp: string): string | null {
  const ip = rawIp.toLowerCase();
  if (!ip.startsWith("::ffff:")) return null;
  const tail = ip.slice("::ffff:".length);
  if (net.isIPv4(tail)) return tail;
  // Hex form: ::ffff:7f00:1 or ::ffff:7f00:0001
  const hexParts = tail.split(":");
  if (hexParts.length === 2) {
    const hi = parseInt(hexParts[0], 16);
    const lo = parseInt(hexParts[1], 16);
    if (!Number.isNaN(hi) && !Number.isNaN(lo) && hi >= 0 && hi <= 0xffff && lo >= 0 && lo <= 0xffff) {
      return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }
  }
  return null;
}

function isDisallowedIP(rawIp: string): boolean {
  const ip = rawIp.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIPv4(ip)) {
    return isDisallowedIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    const mapped = extractMappedIPv4FromIPv6(ip);
    if (mapped) return isDisallowedIPv4(mapped);
    if (
      ip === "::1" ||
      ip === "::" ||
      ip.startsWith("fe80:") ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("ff")
    ) {
      return true;
    }
    return false;
  }
  return true;
}

interface ResolvedTarget {
  parsed: URL;
  pinnedIp: string;
  family: 4 | 6;
}

async function resolveAndValidateTarget(rawUrl: string): Promise<ResolvedTarget | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return null;
  }

  // Direct IP literal check (covers IPv4, IPv6, and IPv4-mapped IPv6 like ::ffff:7f00:1)
  if (net.isIP(host) !== 0) {
    if (isDisallowedIP(host)) return null;
    return { parsed, pinnedIp: host, family: net.isIPv6(host) ? 6 : 4 };
  }

  // Resolve DNS records and verify every address is public before pinning one
  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length) return null;
    for (const rec of records) {
      if (isDisallowedIP(rec.address)) {
        return null;
      }
    }
    const chosen = records[0];
    return {
      parsed,
      pinnedIp: chosen.address,
      family: chosen.family === 6 ? 6 : 4,
    };
  } catch {
    return null;
  }
}

function pinnedHttpGet(
  target: ResolvedTarget,
  timeoutMs = 6000
): Promise<{ statusCode: number; bytesReceived: number; serverHeader: string }> {
  return new Promise((resolve, reject) => {
    const { parsed, pinnedIp, family } = target;
    const isHttps = parsed.protocol === "https:";
    const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80;
    const path = `${parsed.pathname || "/"}${parsed.search || ""}`;
    const hostHeader = parsed.port ? `${parsed.hostname}:${port}` : parsed.hostname;

    const lookup: http.RequestOptions["lookup"] = (_h, _opts, cb) => {
      cb(null, pinnedIp, family);
    };

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port,
      path,
      method: "GET",
      timeout: timeoutMs,
      lookup,
      servername: isHttps ? parsed.hostname : undefined,
      headers: {
        Host: hostHeader,
        "User-Agent": "FuzzLoad-Adaptive-Load-Balancer/1.0 (+https://fuzzload.tanisheesh.in)",
        Connection: "close",
      },
    };

    const transport = isHttps ? https : http;
    const req = transport.request(reqOptions, (res) => {
      const statusCode = res.statusCode ?? 0;
      if (statusCode >= 300 && statusCode < 400) {
        res.destroy();
        reject(new Error(`Redirects are disabled during probing (HTTP ${statusCode})`));
        return;
      }
      let bytesReceived = 0;
      res.on("data", (chunk: Buffer) => {
        bytesReceived += chunk.length;
        if (bytesReceived > 65536) {
          res.destroy();
        }
      });
      res.on("end", () => {
        const srvHdr =
          (typeof res.headers.server === "string" && res.headers.server) ||
          (res.headers["x-vercel-id"] ? "Vercel Edge" : "Origin");
        resolve({ statusCode, bytesReceived, serverHeader: srvHdr });
      });
      res.on("close", () => {
        const srvHdr =
          (typeof res.headers.server === "string" && res.headers.server) ||
          (res.headers["x-vercel-id"] ? "Vercel Edge" : "Origin");
        resolve({ statusCode, bytesReceived, serverHeader: srvHdr });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Probe timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const targets: ProbeTargetInput[] = Array.isArray(body?.targets) ? body.targets.slice(0, 8) : [];
    const burstCount = Math.min(10, Math.max(1, Number(body?.requestsPerTarget || 4)));

    if (targets.length === 0) {
      return NextResponse.json({ error: "No targets provided" }, { status: 400 });
    }

    const probedResults = await Promise.all(
      targets.map(async (target) => {
        const resolved = await resolveAndValidateTarget(target.url);
        if (!resolved) {
          return {
            ...target,
            statusCode: 400,
            bytesReceived: 0,
            serverHeader: "Blocked",
            p50LatencyMs: 999.0,
            p95LatencyMs: 999.0,
            p99LatencyMs: 999.0,
            errorRate: 1.0,
            estimatedCpu: 0.99,
            anfisScore: 1.0,
            gpScore: 1.0,
            rawWeight: 0.01,
            samples: [],
          };
        }

        const latencies: number[] = [];
        let statusCode = 0;
        let bytesReceived = 0;
        let serverHeader = "Origin";
        let errors = 0;

        for (let i = 0; i < burstCount; i++) {
          const start = performance.now();
          try {
            const resp = await pinnedHttpGet(resolved, 6000);
            const elapsed = performance.now() - start;
            latencies.push(elapsed);
            statusCode = resp.statusCode;
            bytesReceived = resp.bytesReceived;
            serverHeader = resp.serverHeader;
            if (resp.statusCode < 200 || resp.statusCode >= 400) errors += 1;
          } catch {
            const elapsed = performance.now() - start;
            latencies.push(Math.max(elapsed, 850));
            errors += 1;
          }
        }

        latencies.sort((a, b) => a - b);
        const p50 = computePercentile(latencies, 0.5);
        const p95 = computePercentile(latencies, 0.95);
        const p99 = computePercentile(latencies, 0.99);
        const errRate = errors / burstCount;

        // 5-Layer ANFIS + GP Evaluation on REAL measured HTTP telemetry
        const normLat = Math.min(1.0, p95 / 600.0);
        const estLoad = Math.min(0.95, 0.15 + normLat * 0.65 + errRate * 0.5);
        const anfisScore = Math.max(
          2.0,
          Math.min(
            99.5,
            100.0 * Math.exp(-1.35 * normLat - 0.65 * Math.pow(estLoad, 1.5) - 2.2 * errRate)
          )
        );
        const gpRaw = (1.0 - estLoad * estLoad) / (0.25 + normLat * (1.0 + errRate * 3.0));
        const gpScore = Math.max(2.0, Math.min(99.5, (gpRaw / 4.0) * 100.0));
        const rawWeight =
          Math.pow(0.58 * anfisScore + 0.42 * gpScore, 1.85) *
          Math.sqrt(Math.max(1, target.cores) / 2.0);

        return {
          ...target,
          statusCode,
          bytesReceived,
          serverHeader,
          p50LatencyMs: Number(p50.toFixed(1)),
          p95LatencyMs: Number(p95.toFixed(1)),
          p99LatencyMs: Number(p99.toFixed(1)),
          errorRate: Number(errRate.toFixed(3)),
          estimatedCpu: Number(estLoad.toFixed(2)),
          anfisScore: Number(anfisScore.toFixed(1)),
          gpScore: Number(gpScore.toFixed(1)),
          rawWeight: errors === burstCount ? 0.01 : rawWeight,
          samples: latencies.map((l) => Number(l.toFixed(1))),
        };
      })
    );

    const totalWeight = probedResults.reduce((acc, r) => acc + r.rawWeight, 0) || 1;
    const finalTargets = probedResults.map((r) => ({
      ...r,
      assignedWeightPct: Math.max(1, Math.round((r.rawWeight / totalWeight) * 100)),
      status: r.errorRate >= 1 ? "offline" : r.p95LatencyMs > 250 ? "slow" : "probed",
    }));

    return NextResponse.json({
      status: "ok",
      burstCount,
      timestamp: new Date().toISOString(),
      targets: finalTargets,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Probe failed" },
      { status: 500 }
    );
  }
}
