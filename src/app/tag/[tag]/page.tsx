import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import TagClient from "./tag-client";

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const title = `#${decoded} posts`;
  const description = `Browse all KEC Archives posts tagged with #${decoded}`;
  const tagUrl = `${siteConfig.url}/tag/${tag}`;

  return {
    title,
    description,
    alternates: { canonical: `/tag/${tag}` },
    openGraph: {
      title,
      description,
      url: tagUrl,
      type: "website",
      siteName: siteConfig.name,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      "max-snippet": -1,
    },
  };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const tagUrl = `${siteConfig.url}/tag/${tag}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `#${decoded} — KEC Archives`,
    "description": `Posts tagged with #${decoded} on KEC Archives`,
    "url": tagUrl,
    "isPartOf": {
      "@type": "WebSite",
      "name": siteConfig.name,
      "url": siteConfig.url,
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": siteConfig.url },
        { "@type": "ListItem", "position": 2, "name": `#${decoded}`, "item": tagUrl },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TagClient tag={tag} />
    </>
  );
}
