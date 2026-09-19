import { NextResponse } from "next/server";
import { buildGalleryZip } from "@/lib/gallery-zip";
import { recordGalleryEvent } from "@/lib/gallery-analytics";
import {
  galleryAccessDeniedReason,
  galleryHasPaidAccess,
  getGalleryByToken,
  listMedia,
} from "@/lib/galleries";

export const runtime = "nodejs";

type Params = { token: string };

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { token } = await context.params;
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
  if (!(await galleryHasPaidAccess(gallery!))) {
    return NextResponse.json(
      { ok: false, error: "Downloads unlock after payment." },
      { status: 402 },
    );
  }
  if (!gallery!.licenseAcceptedAt) {
    return NextResponse.json(
      {
        ok: false,
        error: "Accept the Limited Marketing License before downloading.",
      },
      { status: 403 },
    );
  }

  const kind = new URL(request.url).searchParams.get("kind") === "full" ? "full" : "mls";
  const branded = new URL(request.url).searchParams.get("brand") !== "off";
  const media = await listMedia(gallery!.id);
  if (media.length === 0) {
    return NextResponse.json({ ok: false, error: "No photos." }, { status: 404 });
  }

  const zip = await buildGalleryZip({
    gallery: gallery!,
    media,
    kind,
    branded,
  });

  await recordGalleryEvent({
    tenantId: gallery!.tenantId,
    galleryId: gallery!.id,
    orderId: gallery!.orderId,
    kind: "download",
  });

  const filename = `${gallery!.propertyAddress.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${kind}.zip`;

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
