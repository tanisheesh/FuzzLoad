import React from "react";
import Link from "next/link";
import { Network } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#05070b] text-slate-400 py-10 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">FuzzLoad</div>
            <div className="text-xs text-slate-500">
              Adaptive Web Server Load Balancing · Go + 5-Layer ANFIS + Genetic Programming
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs">
          <Link href="/" className="hover:text-white transition">
            Landing
          </Link>
          <Link href="/dashboard" className="hover:text-white transition">
            Live Demo
          </Link>
          <Link href="/playground" className="hover:text-white transition">
            Proxy Playground
          </Link>
          <Link href="/how-it-works" className="hover:text-white transition">
            How It Works
          </Link>
          <a
            href="https://tanisheesh.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 font-medium transition"
          >
            tanisheesh.in ↗
          </a>
          <a
            href="https://github.com/tanisheesh/FuzzLoad"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
