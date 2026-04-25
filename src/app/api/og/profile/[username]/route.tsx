import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let fullName = username;
  let role = "";

  try {
    const apiBase = process.env.BACKEND_URL || "http://localhost:8000";

    const data = await Promise.race<unknown>([
      fetch(`${apiBase}/api/v1/auth/profile/by-username/${encodeURIComponent(username)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);

    if (data && typeof data === "object") {
      const p = data as Record<string, unknown>;
      if (typeof p.full_name === "string" && p.full_name) fullName = p.full_name;
      if (typeof p.role === "string" && p.role)
        role = p.role.charAt(0).toUpperCase() + p.role.slice(1);
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
          background: "#f6f6f6",
          color: "#0f0f0f",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top — branding */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>KEC Archives</div>
        </div>

        {/* Center — name, handle, role stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: fullName.length > 24 ? 48 : 64,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            {fullName}
          </div>
          <div style={{ fontSize: 28, opacity: 0.45 }}>{"@" + username}</div>
          <div style={{ fontSize: 24, opacity: 0.35 }}>{role}</div>
        </div>

        {/* Bottom — no dot */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, opacity: 0.4 }}>Krishna Engineering College, Bhilai</div>
          <div style={{ fontSize: 18, opacity: 0.3 }}>kecarchives.com</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
