import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "#f6f6f6",
          color: "#0f0f0f",
          border: "12px solid #0f0f0f",
          fontFamily: "ui-sans-serif, system-ui"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>KEC ARCHIVES</div>
          <div style={{ fontSize: 18, opacity: 0.6 }}>community feed</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1 }}>{siteConfig.name}</div>
          <div style={{ fontSize: 30, opacity: 0.75 }}>{siteConfig.description}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#0f0f0f" }} />
          <div style={{ fontSize: 20, opacity: 0.7 }}>Krishna Engineering College</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}
