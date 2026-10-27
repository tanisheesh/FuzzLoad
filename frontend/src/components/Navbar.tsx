"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, Activity, Terminal, BookOpen, Github, ArrowRight } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Overview" },
    { href: "/dashboard", label: "Live Demo", icon: Activity },
    { href: "/playground", label: "Proxy Playground", icon: Terminal },
    { href: "/how-it-works", label: "How It Works", icon: BookOpen },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#07090e]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:border-indigo-400 transition">
            <Network className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-white">FuzzLoad</span>
            <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              v1.0
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  active
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                {item.icon && <item.icon className="w-3.5 h-3.5" />}
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com/tanisheesh/FuzzLoad"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          {pathname !== "/dashboard" ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 transition"
            >
              <span>Launch Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              href="/playground"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>BYO Endpoints</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Sub-nav */}
      <div className="flex md:hidden items-center justify-around border-t border-slate-800/80 bg-slate-950/90 px-2 py-1.5">
        {navLinks.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                active ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
