import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export const revalidate = 3600; // rebuild sitemap at most once per hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base = siteConfig.url;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/public-posts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const apiBase = process.env.BACKEND_URL || "http://localhost:8000";
    const res = await fetch(`${apiBase}/api/v1/posts/feed?filter=public`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return staticRoutes;

    const posts = await res.json();
    if (!Array.isArray(posts)) return staticRoutes;

    const postRoutes: MetadataRoute.Sitemap = [];
    const profileSeen = new Set<string>();
    const tagSeen = new Set<string>();

    for (const post of posts) {
      if (post.author_username && post.slug) {
        postRoutes.push({
          url: `${base}/${post.author_username}/${post.slug}`,
          lastModified: post.created_at ? new Date(post.created_at) : now,
          changeFrequency: "weekly",
          priority: 0.8,
        });
        profileSeen.add(post.author_username);
      }
      if (Array.isArray(post.tags)) {
        for (const t of post.tags) tagSeen.add(t as string);
      }
    }

    const profileRoutes: MetadataRoute.Sitemap = Array.from(profileSeen).map((username) => ({
      url: `${base}/${username}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const tagRoutes: MetadataRoute.Sitemap = Array.from(tagSeen).map((tag) => ({
      url: `${base}/tag/${encodeURIComponent(tag)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

    return [...staticRoutes, ...postRoutes, ...profileRoutes, ...tagRoutes];
  } catch {
    return staticRoutes;
  }
}
