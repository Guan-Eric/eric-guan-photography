import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getGalleryByToken } from "@/lib/galleries";
import { getMediaLink } from "@/lib/media-links";
import { openMediaStream } from "@/lib/media-storage";

export const runtime = "nodejs";

type Params = { token: string; linkId: string };

/** Serves floor-plan PDFs for a gallery without exposing storage paths. */
export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { token, linkId } = await context.params;
  const gallery = await getGalleryByToken(token);
  if (!gallery || gallery.revokedAt) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const link = await getMediaLink(linkId, gallery.tenantId);
  if (!link || link.galleryId !== gallery.id || !link.storagePath) {
    return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });
  }

  const brandMode =
    new URL(request.url).searchParams.get("brand") === "off" ? "unbranded" : "branded";
  if (link.brandMode !== "both" && link.brandMode !== brandMode) {
    return NextResponse.json({ ok: false, error: "Not available." }, { status: 404 });
  }

  const nodeStream = await openMediaStream(link.storagePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const filename = (link.title ?? "floor-plan").replace(/[^a-zA-Z0-9._-]/g, "-");

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${filename}.pdf"`,
    },
  });
}
