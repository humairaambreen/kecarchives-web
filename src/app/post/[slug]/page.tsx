import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
};

function prettifySlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = `${prettifySlug(slug)} - KEC Post`;
  const ogImage = `${siteConfig.ogBaseUrl}/post/${slug}`;

  return {
    title,
    description: "Redirecting to post...",
    openGraph: {
      title,
      url: `${siteConfig.url}/post/${slug}`,
      images: [ogImage],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImage],
    },
  };
}

export default async function OldPostPage({ params }: Props) {
  const { slug } = await params;

  // Try to fetch the post to get author_username for redirect
  try {
    const apiBase = process.env.BACKEND_URL || "http://localhost:8000";
    const res = await fetch(`${apiBase}/api/v1/posts/${slug}`, { cache: "no-store" });
    if (res.ok) {
      const post = await res.json();
      const authorUsername = post.author_username || "post";
      redirect(`/${authorUsername}/${slug}`);
    }
  } catch {
    // If fetch fails, redirect with fallback
  }

  // Fallback: still redirect (without author prefix)
  redirect(`/feed`);
}
