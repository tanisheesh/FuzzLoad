import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[#222220] bg-[#080808] text-[#88857e] mt-12 sm:mt-20">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 font-mono text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 64 64"
            fill="none"
            className="shrink-0"
            aria-hidden="true"
          >
            <rect width="64" height="64" fill="#080808" />
            <rect x="3" y="3" width="58" height="58" stroke="#FF5500" strokeWidth="4" />
            <rect x="11" y="13" width="42" height="15" fill="#FF5500" />
            <rect x="16" y="18" width="5" height="5" fill="#080808" />
            <rect x="26" y="19" width="21" height="3" fill="#080808" />
            <rect x="11" y="36" width="42" height="15" stroke="#F2EFE9" strokeWidth="3" fill="#111111" />
            <rect x="16" y="41" width="5" height="5" fill="#00E676" />
            <rect x="26" y="42" width="21" height="3" fill="#F2EFE9" />
          </svg>
          <div className="space-y-1 min-w-0">
            <div className="text-[#f2efe9] font-bold tracking-wider text-[11px] sm:text-xs">
              FUZZLOAD // ADAPTIVE L7 CONTROL PLANE
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#88857e] leading-relaxed">
              Built by{" "}
              <a
                href="https://tanisheesh.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#f2efe9] hover:text-[#ff5500] underline underline-offset-2"
              >
                Tanish Poddar
              </a>{" "}
              &amp;{" "}
              <a
                href="https://github.com/krish-codess"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#f2efe9] hover:text-[#ff5500] underline underline-offset-2"
              >
                Krish (@krish-codess)
              </a>{" "}
              · Go Reverse Proxy + 5-Layer Takagi-Sugeno ANFIS + Symbolic GP
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] sm:text-[11px] uppercase tracking-wider">
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
