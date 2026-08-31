import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://machimoto.cafe", changeFrequency: "weekly", priority: 1 },
  ];
}
