export const siteConfig = {
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  name: process.env.NEXT_PUBLIC_SITE_NAME || "KEC Archives",
  defaultTitle: process.env.NEXT_PUBLIC_DEFAULT_TITLE || "KEC Archives",
  description:
    process.env.NEXT_PUBLIC_DEFAULT_DESCRIPTION ||
    "Krishna Engineering College community and archives",
  ogBaseUrl:
    process.env.NEXT_PUBLIC_OG_IMAGE_BASE_URL || "http://localhost:3000/api/og",
  twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@kecarchives"
};
