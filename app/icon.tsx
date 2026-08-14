import { ImageResponse } from "next/og";
import { getTenant } from "@/lib/tenants";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const tenant = getTenant();
  const initials = tenant.studioName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tenant.theme.accent,
          color: "#f7f8f5",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: -1,
          fontFamily: "sans-serif",
        }}
      >
        {initials}
      </div>
    ),
    size,
  );
}
