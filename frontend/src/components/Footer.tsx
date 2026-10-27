import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[#222220] bg-[#080808] text-[#88857e] mt-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 font-mono text-xs">
        <div className="space-y-1">
          <div className="text-[#f2efe9] font-bold tracking-wider">
            FUZZLOAD // ADAPTIVE L7 CONTROL PLANE
          </div>
          <div className="text-[11px] text-[#88857e]">
            Built by Tanish Poddar · Go Reverse Proxy + 5-Layer Takagi-Sugeno ANFIS + Symbolic GP
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[11px] uppercase tracking-wider">
          <Link href="/" className="hover:text-[#ff5500] transition">
            [01] Spec
          </Link>
          <Link href="/dashboard" className="hover:text-[#ff5500] transition">
            [02] Console
          </Link>
          <Link href="/playground" className="hover:text-[#ff5500] transition">
            [03] HTTP Prober
          </Link>
          <Link href="/how-it-works" className="hover:text-[#ff5500] transition">
            [04] Math
          </Link>
          <a
            href="https://github.com/tanisheesh/FuzzLoad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f2efe9] hover:text-[#ff5500] transition"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
