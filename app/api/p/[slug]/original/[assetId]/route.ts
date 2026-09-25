import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { listingPageForPublic } from "@/lib/listing-pages";
import { openMediaStream } from "@/lib/media-storage";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { slug: string; assetId: string };

/**
 * Public unaltered web-resolution original for California BPC 10140.8 /
 * OACIQ "available upon request" disclosure. Only assets with
 * disclosure_public = 1 are served.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const { slug, assetId } = await context.params;
  const data = await listingPageForPublic(tenant.id, slug);
  if (data.state !== "live") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const asset = data.media.find((item) => item.id === assetId);
  if (!asset || asset.disclosurePublic !== 1) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const nodeStream = await openMediaStream(asset.pathWeb);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="original-${asset.id}.jpg"`,
    },
  });
}
