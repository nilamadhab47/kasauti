import { ImageResponse } from "next/og";
import { reportBySlug, topFinding } from "@/lib/report-model";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = reportBySlug(slug);
  const run = report?.runs[report.runs.length - 1];
  const line = report && run ? `${report.name} · ${run.score}/100 · ${topFinding(run)}` : "Kasauti report";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E0D0C",
          padding: "64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "28px",
            background: "#FFFDFB",
            borderRadius: "28px",
            padding: "36px 48px",
            maxWidth: "1040px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "999px",
              background: "#FFB800",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "22px", height: "22px", borderRadius: "999px", background: "#0E0D0C" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "22px", letterSpacing: "0.14em", color: "#A16207", textTransform: "uppercase" }}>Kasauti report</div>
            <div style={{ fontSize: "40px", fontWeight: 700, color: "#0F0E0C", lineHeight: 1.2 }}>{line}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
