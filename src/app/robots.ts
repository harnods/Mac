import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/hr", "/orders", "/settings", "/stock", "/purchasing", "/inventory", "/recipes", "/me"] },
    ],
    sitemap: "https://machimoto.cafe/sitemap.xml",
    host: "https://machimoto.cafe",
  };
}
