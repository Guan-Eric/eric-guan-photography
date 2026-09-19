import { NextResponse } from "next/server";
import { z } from "zod";
import {
  acceptGalleryLicense,
  galleryAccessDeniedReason,
  getGalleryByToken,
} from "@/lib/galleries";

export const runtime = "nodejs";

type Params = { token: string };

const bodySchema = z.object({
  language: z.enum(["en", "fr"]).optional(),
});

export async function POST(
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

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const language = parsed.success ? parsed.data.language ?? "en" : "en";

  const result = await acceptGalleryLicense(gallery!.id, language);
  if (!result.ok) {
    const status =
      result.error.includes("payment") ? 402 : result.error.includes("expired") ? 410 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({
    ok: true,
    alreadyAccepted: result.alreadyAccepted,
    licenseAcceptedAt: result.gallery.licenseAcceptedAt,
    licenseAcceptedLanguage: result.gallery.licenseAcceptedLanguage,
  });
}
