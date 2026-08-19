import { NextResponse } from "next/server";
import {
  attachPhotographerSession,
  createMembership,
  registerUser,
} from "@/lib/auth";
import { acceptInvite, getInviteByToken, inviteAcceptanceError } from "@/lib/invites";
import { passwordIssues } from "@/lib/password-rules";
import { createTenantFromOnboarding } from "@/lib/tenant-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const legacyName = typeof body?.name === "string" ? body.name.trim() : "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || legacyName;
  const studioName = typeof body?.studioName === "string" ? body.studioName.trim() : "";
  const invite = typeof body?.invite === "string" ? body.invite.trim() : "";
  const referralCode = typeof body?.referralCode === "string" ? body.referralCode.trim() : "";

  if (!email || !password || !name) {
    return NextResponse.json(
      { ok: false, error: "Name, email, and password are required." },
      { status: 400 },
    );
  }

  const issues = passwordIssues(password);
  if (issues.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Password: ${issues[0]!.toLowerCase()}.` },
      { status: 400 },
    );
  }

  if (!invite && studioName.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Studio name is required." },
      { status: 400 },
    );
  }

  if (invite) {
    const inviteRow = await getInviteByToken(invite);
    const inviteError = inviteAcceptanceError(inviteRow, email);
    if (inviteError) {
      return NextResponse.json({ ok: false, error: inviteError }, { status: 400 });
    }
  }

  const created = await registerUser({ email, password, name });
  if (!created.ok) {
    return NextResponse.json(created, { status: 400 });
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (invite) {
    const accepted = await acceptInvite({
      token: invite,
      userId: created.user.id,
      userEmail: created.user.email,
    });
    if (!accepted.ok) {
      return NextResponse.json(accepted, { status: 400 });
    }
    const response = NextResponse.json({
      ok: true,
      userId: created.user.id,
      hasStudio: true,
      joinedInvite: true,
    });
    attachPhotographerSession(response, created.user.id, accepted.tenantId, host);
    return response;
  }

  if (studioName.length >= 2) {
    const provisioned = await createTenantFromOnboarding({
      studioName,
      photographerName: name,
      email: created.user.email,
    });
    await createMembership({
      userId: created.user.id,
      tenantId: provisioned.tenant.id,
      role: "owner",
    });
    if (referralCode) {
      const { applyReferralOnSignup } = await import("@/lib/referrals");
      await applyReferralOnSignup(referralCode, provisioned.tenant.id);
    }
    const response = NextResponse.json({
      ok: true,
      userId: created.user.id,
      hasStudio: true,
      slug: provisioned.tenant.slug,
    });
    attachPhotographerSession(response, created.user.id, provisioned.tenant.id, host);
    return response;
  }

  const response = NextResponse.json({
    ok: true,
    userId: created.user.id,
    hasStudio: false,
  });
  attachPhotographerSession(response, created.user.id, undefined, host);
  return response;
}
