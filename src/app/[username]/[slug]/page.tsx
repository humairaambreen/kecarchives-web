import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import PostDetailClient from "./post-detail-client";

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

function prettifySlug(slug: string) {
  return slug
    .split("-")
    .slice(0, -1)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") || slug;
}

async function fetchPost(slug: string) {
  try {
    const apiBase = process.env.BACKEND_URL || "http://localhost:8000";
    const res = await fetch(`${apiBase}/api/v1/posts/${slug}`, { next: { revalidate: 60 } });
    if (res.ok) return await res.json();
  } catch { /* use defaults */ }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const post = await fetchPost(slug);

  const title = post?.title ?? prettifySlug(slug);
  const description = post?.content
    ? post.content.slice(0, 160).replace(/\n/g, " ") + (post.content.length > 160 ? "…" : "")
    : `Post by @${username} on KEC Archives`;
  const ogImage = `${siteConfig.ogBaseUrl}/post/${slug}`;
  const postUrl = `${siteConfig.url}/${username}/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: `/${username}/${slug}` },
    openGraph: {
      title,
      description,
      url: postUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      type: "article",
      siteName: siteConfig.name,
      ...(post?.created_at && { publishedTime: post.created_at }),
      ...(post?.tags?.length && { tags: post.tags }),
    },
    twitter: {
      card: "summary_large_image",
      creator: `@${username}`,
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { username, slug } = await params;
  const post = await fetchPost(slug);

  const postUrl = `${siteConfig.url}/${username}/${slug}`;
  const authorUrl = post?.author_username ? `${siteConfig.url}/${post.author_username}` : undefined;
  const title = post?.title ?? prettifySlug(slug);
  const excerpt = post?.content
    ? post.content.slice(0, 500).replace(/\n/g, " ")
    : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "headline": title,
    "url": postUrl,
    ...(excerpt && { "text": excerpt }),
    ...(post?.created_at && { "datePublished": post.created_at }),
    "author": {
      "@type": "Person",
      "name": post?.author_name ?? username,
      ...(authorUrl && { "url": authorUrl }),
      ...(post?.author_role && {
        "jobTitle": post.author_role.charAt(0).toUpperCase() + post.author_role.slice(1),
      }),
    },
    "interactionStatistic": [
      {
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/CommentAction",
        "userInteractionCount": post?.comments_count ?? 0,
      },
      {
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/LikeAction",
        "userInteractionCount": post?.reactions_count ?? 0,
      },
    ],
    ...(post?.tags?.length && { "keywords": post.tags.join(", ") }),
    "isPartOf": {
      "@type": "WebSite",
      "name": siteConfig.name,
      "url": siteConfig.url,
    },
    "image": `${siteConfig.ogBaseUrl}/post/${slug}`,
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": siteConfig.url },
        ...(post?.author_username
          ? [{ "@type": "ListItem", "position": 2, "name": `@${post.author_username}`, "item": `${siteConfig.url}/${post.author_username}` }]
          : []),
        {
          "@type": "ListItem",
          "position": post?.author_username ? 3 : 2,
          "name": title,
          "item": postUrl,
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostDetailClient slug={slug} />
    </>
  );
}
