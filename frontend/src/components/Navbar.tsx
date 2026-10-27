"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", code: "01", label: "SPECIFICATION" },
    { href: "/dashboard", code: "02", label: "LIVE TELEMETRY" },
    { href: "/playground", code: "03", label: "HTTP PROBER" },
    { href: "/how-it-works", code: "04", label: "MATHEMATICS" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#080808] border-b border-[#222220]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-7 h-7 bg-[#ff5500] text-[#080808] font-mono font-bold text-xs flex items-center justify-center tracking-tighter">
            FL
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-2xl tracking-tight text-[#f2efe9]">
              FUZZLOAD
            </span>
            <span className="hidden sm:inline font-mono text-[10px] text-[#88857e] tracking-widest">
              SYS.REV.1.0 // GO+ANFIS+GP
            </span>
          </div>
        </Link>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center h-full">
          {navLinks.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`h-14 px-5 flex items-center gap-2 font-mono text-xs tracking-wider border-l border-[#222220] last:border-r transition-colors ${
                  active
                    ? "bg-[#151515] text-[#ff5500] border-b-2 border-b-[#ff5500]"
                    : "text-[#88857e] hover:text-[#f2efe9] hover:bg-[#0e0e0e]"
                }`}
              >
                <span className="text-[10px] text-[#4a4843]">[{item.code}]</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/tanisheesh/FuzzLoad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-[#88857e] hover:text-[#f2efe9] px-3 py-1.5 border border-[#222220] hover:border-[#88857e] transition"
          >
            SRC ↗
          </a>
          {pathname !== "/dashboard" ? (
            <Link href="/dashboard" className="brutal-btn brutal-btn-primary !py-2 !px-4">
              OPEN CONSOLE →
            </Link>
          ) : (
            <Link href="/playground" className="brutal-btn !py-2 !px-4 !border-[#00e676] !text-[#00e676]">
              PROBE URL →
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Bar */}
      <div className="grid grid-cols-4 md:hidden border-t border-[#222220] bg-[#0b0b0b]">
        {navLinks.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`py-2 text-center font-mono text-[10px] tracking-wider border-r border-[#222220] last:border-r-0 ${
                active ? "text-[#ff5500] bg-[#151515] font-bold" : "text-[#88857e]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
