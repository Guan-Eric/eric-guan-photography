import { NextResponse } from "next/server";
import { buildGalleryZip } from "@/lib/gallery-zip";
import { recordGalleryEvent } from "@/lib/gallery-analytics";
import { galleryHasPaidAccess, getGalleryByToken, listMedia } from "@/lib/galleries";

export const runtime = "nodejs";

type Params = { token: string };

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { token } = await context.params;
  const gallery = await getGalleryByToken(token);
  if (!gallery || gallery.revokedAt) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (!(await galleryHasPaidAccess(gallery))) {
    return NextResponse.json(
      { ok: false, error: "Downloads unlock after payment." },
      { status: 402 },
    );
  }

  const kind = new URL(request.url).searchParams.get("kind") === "full" ? "full" : "mls";
  const branded = new URL(request.url).searchParams.get("brand") !== "off";
  const media = await listMedia(gallery.id);
  if (media.length === 0) {
    return NextResponse.json({ ok: false, error: "No photos." }, { status: 404 });
  }

  const zip = await buildGalleryZip({
    gallery,
    media,
    kind,
    branded,
  });

  await recordGalleryEvent({
    tenantId: gallery.tenantId,
    galleryId: gallery.id,
    orderId: gallery.orderId,
    kind: "download",
  });

  const filename = `${gallery.propertyAddress.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${kind}.zip`;

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
