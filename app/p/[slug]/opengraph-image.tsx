import { ImageResponse } from "next/og";
import { listingPageForPublic } from "@/lib/listing-pages";
import { getRequestTenant } from "@/lib/tenants";

export const alt = "Listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ListingOg({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tenant = await getRequestTenant();
  const { slug } = await params;
  const data = tenant ? await listingPageForPublic(tenant.id, slug) : null;
  const title = data?.page.title ?? "Listing";
  const studio = data?.tenant.studioName ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 64,
          background: "#171a17",
          color: "#f7f8f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>
          {studio}
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
      </div>
    ),
    size,
  );
}
