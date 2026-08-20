import { NextResponse } from "next/server";
import {
  attachPhotographerSession,
  getPhotographerSession,
  requireTenantMembership,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Studio id required." }, { status: 400 });
  }

  const auth = await requireTenantMembership(tenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 403 });
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.json({ ok: true, tenantId });
  attachPhotographerSession(response, session.user.id, tenantId, host);
  return response;
}
