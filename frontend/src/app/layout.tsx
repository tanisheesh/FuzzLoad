import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FuzzLoad — Adaptive Load Balancing via Genetic Programming & Neuro-Fuzzy Control",
  description:
    "Real-time observability & chaos engineering console for FuzzLoad: 5-Layer ANFIS Neuro-Fuzzy Controller + Genetic Programming Symbolic Optimizer + Go Reverse Proxy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07090e] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
