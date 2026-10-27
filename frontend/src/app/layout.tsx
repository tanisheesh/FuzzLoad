import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://fuzzload.tanisheesh.in";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080808",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FuzzLoad — Adaptive L7 Load Balancing via ANFIS & Genetic Programming",
    template: "%s | FuzzLoad",
  },
  description:
    "Adaptive Web Server Load Balancing Using Genetic Programming and 5-Layer Takagi-Sugeno Neuro-Fuzzy (ANFIS) Control. Lock-free Go Reverse Proxy + Real-Time Chaos Engineering Console.",
  applicationName: "FuzzLoad",
  authors: [{ name: "Tanish Poddar", url: "https://tanisheesh.in" }],
  creator: "Tanish Poddar",
  publisher: "Tanish Poddar",
  keywords: [
    "FuzzLoad",
    "Adaptive Load Balancing",
    "Neuro-Fuzzy Control",
    "ANFIS",
    "Takagi-Sugeno Fuzzy Logic",
    "Genetic Programming",
    "Reverse Proxy",
    "Go Load Balancer",
    "Distributed Systems",
    "Tail Latency Optimization",
    "Soft Computing",
    "Tanish Poddar",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "FuzzLoad",
    title: "FuzzLoad — Adaptive L7 Load Balancing via ANFIS & Genetic Programming",
    description:
      "Stop routing traffic blindly. FuzzLoad decouples a lock-free Go Reverse Proxy from a 5-Layer Neuro-Fuzzy (ANFIS) Fast Loop and Symbolic Genetic Programming Slow Loop.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FuzzLoad — Adaptive L7 Load Balancing via ANFIS & Genetic Programming",
    description:
      "Lock-free Go Reverse Proxy + 5-Layer Takagi-Sugeno ANFIS (500ms online backprop) + Symbolic Genetic Programming over a 60s Digital Twin replay buffer.",
    creator: "@tanisheeshh",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  category: "technology",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FuzzLoad",
  operatingSystem: "Linux, Windows, macOS, Docker",
  applicationCategory: "DeveloperApplication",
  url: SITE_URL,
  author: {
    "@type": "Person",
    name: "Tanish Poddar",
    url: "https://tanisheesh.in",
  },
  description:
    "Adaptive Web Server Load Balancing Using Genetic Programming and 5-Layer Takagi-Sugeno Neuro-Fuzzy Control.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen overflow-x-hidden antialiased selection:bg-[#ff5500] selection:text-black">
        {children}
      </body>
    </html>
  );
}
