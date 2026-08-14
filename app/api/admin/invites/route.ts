import { NextResponse } from "next/server";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { createInvite, listInvites } from "@/lib/invites";
import type { MembershipRole } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }
  return NextResponse.json({ ok: true, invites: listInvites(session.activeTenantId) });
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
  if (auth.membership.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Only owners can invite." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const role: MembershipRole = body.role === "owner" ? "owner" : "editor";
  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const result = await createInvite({
    tenantId: session.activeTenantId,
    email,
    role,
    invitedByUserId: session.user.id,
    acceptUrl: `${origin}/invite/TOKEN`,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({
    ok: true,
    inviteId: result.invite.id,
    acceptPath: `/invite/${result.invite.token}`,
  });
}
