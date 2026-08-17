import { NextResponse } from "next/server";
import {
  createMembership,
  getPhotographerSession,
  setActiveTenantCookie,
} from "@/lib/auth";
import { normalizeStudioCurrency } from "@/lib/currency";
import { createTenantFromOnboarding } from "@/lib/tenant-store";
import { normalizeTimeZone } from "@/lib/timezones";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  if (session.memberships.length > 0 && !request.headers.get("x-allow-additional-tenant")) {
    // Allow creating another studio intentionally via body.force
  }

  const body = await request.json().catch(() => null);
  const studioName = typeof body?.studioName === "string" ? body.studioName.trim() : "";
  const photographerName =
    typeof body?.photographerName === "string"
      ? body.photographerName.trim()
      : session.user.name;
  const slug = typeof body?.slug === "string" ? body.slug.trim() : undefined;
  const timezone = normalizeTimeZone(body?.timezone);
  const accent = typeof body?.accent === "string" ? body.accent : undefined;
  const currency = normalizeStudioCurrency(body?.currency);

  if (studioName.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Studio name is required." },
      { status: 400 },
    );
  }

  const created = await createTenantFromOnboarding({
    studioName,
    photographerName,
    email: session.user.email,
    slug,
    timezone,
    accent,
    currency,
  });

  await createMembership({
    userId: session.user.id,
    tenantId: created.tenant.id,
    role: "owner",
  });
  await setActiveTenantCookie(created.tenant.id);

  return NextResponse.json({
    ok: true,
    tenantId: created.tenant.id,
    slug: created.tenant.slug,
  });
}
