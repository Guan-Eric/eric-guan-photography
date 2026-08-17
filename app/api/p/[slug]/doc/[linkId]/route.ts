import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { listingPageForPublic } from "@/lib/listing-pages";
import { openMediaStream } from "@/lib/media-storage";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { slug: string; linkId: string };

/** Serves floor-plan PDFs attached to a published listing page. */
export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const { slug, linkId } = await context.params;
  const data = await listingPageForPublic(tenant.id, slug);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const link = data.links.find((item) => item.id === linkId);
  if (!link?.storagePath) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const nodeStream = await openMediaStream(link.storagePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const filename = (link.title ?? "floor-plan").replace(/[^a-zA-Z0-9._-]/g, "-");

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=600",
      "Content-Disposition": `inline; filename="${filename}.pdf"`,
    },
  });
}
