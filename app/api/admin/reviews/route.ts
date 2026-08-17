import { NextResponse } from "next/server";
import { z } from "zod";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { listTestimonials, setTestimonialApproval } from "@/lib/reviews";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().min(1),
  approved: z.boolean(),
});

export async function GET() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }
  const items = await listTestimonials(session.activeTenantId, false);
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Missing review." }, { status: 400 });
  }
  const result = await setTestimonialApproval(
    session.activeTenantId,
    parsed.data.id,
    parsed.data.approved,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
