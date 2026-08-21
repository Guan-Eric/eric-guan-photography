import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  APPSUMO_PENDING_COOKIE,
  applyLicenseToTenant,
  decodePendingCookie,
  pendingCookieOptions,
} from "@/lib/appsumo";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await getPhotographerSession();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Sign in to link your AppSumo license." },
      { status: 401 },
    );
  }
  if (!session.activeTenantId) {
    return NextResponse.json(
      { ok: false, error: "Create a studio first, then finish AppSumo activation." },
      { status: 400 },
    );
  }

  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const cookieStore = await cookies();
  const licenseKey = decodePendingCookie(
    cookieStore.get(APPSUMO_PENDING_COOKIE)?.value,
  );
  if (!licenseKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No pending AppSumo license. Start activation from AppSumo again, or contact support.",
      },
      { status: 400 },
    );
  }

  const linked = await applyLicenseToTenant(licenseKey, session.activeTenantId, {
    userId: session.user.id,
  });
  if (!linked.ok) {
    return NextResponse.json({ ok: false, error: linked.error }, { status: 400 });
  }

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? null;
  const response = NextResponse.json({
    ok: true,
    plan: linked.plan,
    redirect: "/admin?appsumo=1",
  });
  response.cookies.set(APPSUMO_PENDING_COOKIE, "", {
    ...pendingCookieOptions(host),
    maxAge: 0,
  });
  return response;
}
