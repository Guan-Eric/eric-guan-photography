import { ImageResponse } from "next/og";
import { platformName } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";

export const alt = "Studiofront — Book the shoot. Deliver the gallery. Get paid.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HERO =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&h=630&q=80";

export default async function OpengraphImage() {
  const tenant = await getRequestTenant();
  const title = tenant?.studioName ?? platformName();
  const lines = tenant?.tagline
    ? [tenant.tagline]
    : ["Book the shoot. Deliver the gallery.", "Get paid."];
  const photo =
    tenant?.hero?.src && /^https?:\/\//.test(tenant.hero.src)
      ? tenant.hero.src
      : HERO;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#1a1f24",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- OG canvas */}
        <img
          src={photo}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 72,
            background:
              "linear-gradient(180deg, rgba(12,16,20,0.15) 20%, rgba(12,16,20,0.72) 100%)",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1.3,
              opacity: 0.95,
              maxWidth: 900,
            }}
          >
            {lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
