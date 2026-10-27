import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://fuzzload.tanisheesh.in/sitemap.xml",
    host: "https://fuzzload.tanisheesh.in",
  };
}
