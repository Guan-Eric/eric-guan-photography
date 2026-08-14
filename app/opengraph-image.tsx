import { ImageResponse } from "next/og";
import { getTenant } from "@/lib/tenants";

export const alt = "Real estate photography";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const tenant = getTenant();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "72px",
          background: `linear-gradient(135deg, ${tenant.theme.bg} 0%, ${tenant.theme.bgDeep} 55%, ${tenant.theme.accent} 190%)`,
          color: tenant.theme.ink,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: tenant.theme.accent,
            marginBottom: 24,
          }}
        >
          {tenant.studioName}
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          {tenant.tagline}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            color: tenant.theme.inkSoft,
          }}
        >
          {`${tenant.serviceAreas[0]?.city ?? "Real estate photography"} · ${tenant.turnaround} delivery`}
        </div>
      </div>
    ),
    size,
  );
}
