import { ImageResponse } from "next/og";
import { platformName, platformSeo, platformTheme } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";

export const alt = "Real estate photography platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const tenant = await getRequestTenant();
  const theme = tenant?.theme ?? platformTheme();
  const title = tenant?.studioName ?? platformName();
  const tagline = tenant?.tagline ?? platformSeo().description;

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
          background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bgDeep} 55%, ${theme.accent} 190%)`,
          color: theme.ink,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: theme.accent,
            marginBottom: 24,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 980,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    size,
  );
}
