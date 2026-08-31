import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Machimoto Cafe — BSD";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#f0eee6", color: "#3d3929", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 34, letterSpacing: 4, textTransform: "uppercase", color: "#a4562f" }}>Machimoto Cafe</div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 14, lineHeight: 1.1 }}>Japanese comfort food &amp; coffee</div>
        <div style={{ fontSize: 34, marginTop: 22, opacity: 0.75 }}>Ruko DelRey Biztown, BSD · Work-friendly WFC / WFA spot</div>
      </div>
    ),
    { ...size },
  );
}
