import { ImageResponse } from "next/og";
import { getOpeningByCode } from "@/app/actions/apply";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Machimoto — Apply position";

export default async function OpengraphImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const opening = await getOpeningByCode(code);
  const position = opening?.title ?? "Lowongan Kerja";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0f7a3d",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, opacity: 0.9 }}>Machimoto</div>
        <div style={{ fontSize: 34, marginTop: 40, opacity: 0.85 }}>Apply position</div>
        <div style={{ fontSize: 88, fontWeight: 800, marginTop: 8, lineHeight: 1.05 }}>{position}</div>
      </div>
    ),
    { ...size },
  );
}
