import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import ProfileClient from "./profile-client";

type Props = { params: Promise<{ username: string }> };

async function fetchProfile(username: string) {
  try {
    const apiBase = process.env.BACKEND_URL || "http://localhost:8000";
    const res = await fetch(
      `${apiBase}/api/v1/auth/profile/by-username/${encodeURIComponent(username)}`,
      { next: { revalidate: 300 } }
    );
    if (res.ok) return await res.json();
  } catch { /* use defaults */ }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchProfile(username);

  const fullName = profile?.full_name ?? username;
  const bio = profile?.bio ?? `Posts and profile of @${username} on KEC Archives`;
  const role = profile?.role ?? "";
  const batchYear = profile?.batch_year;

  const title = `${fullName} (@${username})`;
  const description = [bio, role && `Role: ${role}`, batchYear && `Batch ${batchYear}`]
    .filter(Boolean)
    .join(" · ");
  const profileUrl = `${siteConfig.url}/${username}`;
  const ogImage = `${siteConfig.ogBaseUrl}/profile/${username}`;

  return {
    title,
    description,
    alternates: { canonical: `/${username}` },
    openGraph: {
      title,
      description,
      url: profileUrl,
      type: "profile",
      siteName: siteConfig.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      "max-snippet": -1,
    },
  };
}

export default async function UsernamePage({ params }: Props) {
  const { username } = await params;
  const profile = await fetchProfile(username);

  const profileUrl = `${siteConfig.url}/${username}`;
  const fullName = profile?.full_name ?? username;
  const bio = profile?.bio ?? `Posts and profile of @${username} on KEC Archives`;
  const role = profile?.role;
  const batchYear = profile?.batch_year;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "url": profileUrl,
    "mainEntity": {
      "@type": "Person",
      "name": fullName,
      "identifier": `@${username}`,
      "url": profileUrl,
      ...(bio && { "description": bio }),
      ...(role && { "jobTitle": role.charAt(0).toUpperCase() + role.slice(1) }),
      ...(batchYear && {
        "alumniOf": {
          "@type": "EducationalOrganization",
          "name": "Krishna Engineering College",
          "alternateName": "KEC Bhilai",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Khamariya",
            "addressLocality": "Bhilai",
            "addressRegion": "Chhattisgarh",
            "addressCountry": "IN",
          },
        },
      }),
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": siteConfig.url },
        { "@type": "ListItem", "position": 2, "name": fullName, "item": profileUrl },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileClient username={username} />
    </>
  );
}
