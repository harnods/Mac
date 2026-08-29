import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Machimoto — Job Application";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "80px", background: "#0f7a3d", color: "#ffffff", fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.9 }}>Machimoto</div>
        <div style={{ fontSize: 88, fontWeight: 800, marginTop: 12, lineHeight: 1.05 }}>Job Application</div>
        <div style={{ fontSize: 34, marginTop: 24, opacity: 0.85 }}>Lamar posisi di Machimoto — BSD</div>
      </div>
    ),
    { ...size },
  );
}
