import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/public-posts", "/post/", "/tag/"],
        disallow: ["/admin", "/faculty", "/messages", "/students-only", "/auth"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
