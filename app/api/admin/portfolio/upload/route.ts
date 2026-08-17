import { NextResponse } from "next/server";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { processPortfolioImage } from "@/lib/media-process";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getPhotographerSession();
    if (!session?.activeTenantId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    const auth = await requireTenantMembership(session.activeTenantId);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ ok: false, error: "Choose an image file." }, { status: 400 });
    }

    const result = await processPortfolioImage({
      tenantId: session.activeTenantId,
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name || "portfolio.jpg",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not upload that image.";
    console.error("[portfolio-upload]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
