import { NextResponse } from "next/server";
import {
  galleryHasPaidAccess,
  getGalleryByToken,
  listMedia,
} from "@/lib/galleries";
import { openMediaStream } from "@/lib/media-storage";
import { Readable } from "node:stream";

export const runtime = "nodejs";

type Params = { token: string; assetId: string };

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { token, assetId } = await context.params;
  const gallery = await getGalleryByToken(token);
  if (!gallery || gallery.revokedAt) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const variant = url.searchParams.get("v") ?? "proof";
  const media = (await listMedia(gallery.id)).find((asset) => asset.id === assetId);
  if (!media) {
    return NextResponse.json({ ok: false, error: "Asset not found." }, { status: 404 });
  }

  const unlocked = await galleryHasPaidAccess(gallery);
  if ((variant === "full" || variant === "mls") && !unlocked) {
    return NextResponse.json(
      { ok: false, error: "Full downloads unlock after payment." },
      { status: 402 },
    );
  }

  const relative =
    variant === "full"
      ? media.pathOriginal
      : variant === "mls"
        ? media.pathMls
        : variant === "web"
          ? media.pathWeb
          : media.pathProof;

  const nodeStream = await openMediaStream(relative);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": unlocked ? "private, max-age=3600" : "private, max-age=60",
      "Content-Disposition": `inline; filename="${assetId}-${variant}.jpg"`,
    },
  });
}
