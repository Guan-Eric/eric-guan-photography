import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { getListingPage, listingPageMedia } from "@/lib/listing-pages";
import { openMediaStream } from "@/lib/media-storage";

export const runtime = "nodejs";

type Params = { id: string; assetId: string };

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const { id, assetId } = await context.params;
  const page = await getListingPage(id, session.activeTenantId);
  if (!page) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const asset = (await listingPageMedia(page)).find((item) => item.id === assetId);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const nodeStream = await openMediaStream(asset.pathWeb);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
