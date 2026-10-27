import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FUZZLOAD // Adaptive L7 Load Balancer — ANFIS + Genetic Programming",
  description:
    "Lock-free Go Reverse Proxy + 5-Layer Takagi-Sugeno Neuro-Fuzzy Controller + Genetic Programming Symbolic Optimizer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased selection:bg-[#ff5500] selection:text-black">
        {children}
      </body>
    </html>
  );
}
