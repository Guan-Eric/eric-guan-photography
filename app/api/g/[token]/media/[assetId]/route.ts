import { NextResponse } from "next/server";
import {
  galleryAccessDeniedReason,
  galleryHasPaidAccess,
  getGalleryByToken,
  listMedia,
} from "@/lib/galleries";
import { openMediaStream } from "@/lib/media-storage";
import { Readable } from "node:stream";

export const runtime = "nodejs";

type Params = { token: string; assetId: string };

const PAID_VARIANTS = new Set(["web", "mls", "full"]);

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { token, assetId } = await context.params;
  const gallery = await getGalleryByToken(token);
  const denied = galleryAccessDeniedReason(gallery);
  if (denied) {
    const status = denied === "expired" || denied === "revoked" ? 410 : 404;
    return NextResponse.json(
      {
        ok: false,
        error:
          denied === "expired" || denied === "revoked"
            ? "This gallery link has expired. Ask your photographer for a new link."
            : "Not found.",
        reason: denied,
      },
      { status },
    );
  }

  const url = new URL(request.url);
  const variant = url.searchParams.get("v") ?? "proof";
  const media = (await listMedia(gallery!.id)).find((asset) => asset.id === assetId);
  if (!media) {
    return NextResponse.json({ ok: false, error: "Asset not found." }, { status: 404 });
  }

  const unlocked = await galleryHasPaidAccess(gallery!);
  if (PAID_VARIANTS.has(variant) && !unlocked) {
    return NextResponse.json(
      { ok: false, error: "Full downloads unlock after payment." },
      { status: 402 },
    );
  }
  if ((variant === "full" || variant === "mls") && !gallery!.licenseAcceptedAt) {
    return NextResponse.json(
      {
        ok: false,
        error: "Accept the Limited Marketing License before downloading.",
      },
      { status: 403 },
    );
  }
  if (variant !== "proof" && !PAID_VARIANTS.has(variant)) {
    return NextResponse.json({ ok: false, error: "Unknown variant." }, { status: 400 });
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
