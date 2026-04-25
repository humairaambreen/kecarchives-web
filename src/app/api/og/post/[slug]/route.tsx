import { ImageResponse } from "next/og";

export const runtime = "edge";

function prettifySlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Fetch post data — use real title instead of prettified slug
  let title = prettifySlug(slug);
  let authorName = "";
  let authorRole = "";
  let postDate = "";
  try {
    const apiBase = process.env.BACKEND_URL || "http://localhost:8000";
    const res = await fetch(`${apiBase}/api/v1/posts/${slug}`);
    if (res.ok) {
      const post = await res.json();
      if (post.title) title = post.title;
      authorName = post.author_name || "";
      authorRole = post.author_role || "";
      const d = new Date(post.created_at);
      postDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  } catch { /* use defaults */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 60,
          background: "linear-gradient(145deg, #fafafa 0%, #f0f0f0 100%)",
          color: "#101010",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top — branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: "#101010" }} />
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>KEC Archives</div>
        </div>

        {/* Center — title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: "90%" }}>
          <div
            style={{
              fontSize: title.length > 60 ? 42 : title.length > 40 ? 52 : 60,
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxHeight: 260,
              overflow: "hidden",
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom — author + date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {authorName && (
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {authorName}
              </div>
            )}
            <div style={{ fontSize: 16, opacity: 0.5, display: "flex", gap: 12 }}>
              {authorRole && <span style={{ textTransform: "capitalize" }}>{authorRole}</span>}
              {postDate && <span>{postDate}</span>}
            </div>
          </div>
          <div style={{ fontSize: 16, opacity: 0.4 }}>Read on kec archives</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
