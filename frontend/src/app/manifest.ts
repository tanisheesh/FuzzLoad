import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FuzzLoad — Adaptive L7 Load Balancer (ANFIS + Genetic Programming)",
    short_name: "FuzzLoad",
    description:
      "Adaptive Web Server Load Balancing Using Genetic Programming and 5-Layer Takagi-Sugeno Neuro-Fuzzy Control.",
    start_url: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#ff5500",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
