import { NextResponse } from "next/server";
import { z } from "zod";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { LISTING_THEMES } from "@/lib/listing-themes";
import { getListingPage, updateListingPage } from "@/lib/listing-pages";

export const runtime = "nodejs";

type Params = { id: string };

const patchSchema = z.object({
  theme: z.enum(LISTING_THEMES).optional(),
  heroAssetId: z.string().trim().max(40).nullable().optional(),
  brandMode: z.enum(["branded", "unbranded"]).optional(),
  published: z.boolean().optional(),
  captions: z
    .array(
      z.object({
        id: z.string().trim().max(40),
        caption: z.string().trim().max(80),
      }),
    )
    .max(80)
    .optional(),
});

async function tenantFor() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;
  const auth = await requireTenantMembership(session.activeTenantId);
  return auth.ok ? session.activeTenantId : null;
}

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const tenantId = await tenantFor();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  const page = await getListingPage(id, tenantId);
  if (!page) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, page });
}

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  const tenantId = await tenantFor();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Check the listing fields and try again." },
      { status: 400 },
    );
  }

  const result = await updateListingPage(id, tenantId, parsed.data);
  if (!result.ok) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result);
}
