import { NextResponse } from "next/server";
import {
  createMembership,
  createPhotographerSession,
  registerUser,
  setActiveTenantCookie,
} from "@/lib/auth";
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

  const created = await registerUser({ email, password, name });
  if (!created.ok) {
    return NextResponse.json(created, { status: 400 });
  }

  await createPhotographerSession(created.user.id);

  if (!invite && studioName.length >= 2) {
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
    await setActiveTenantCookie(provisioned.tenant.id);
    return NextResponse.json({
      ok: true,
      userId: created.user.id,
      hasStudio: true,
      slug: provisioned.tenant.slug,
    });
  }

  return NextResponse.json({
    ok: true,
    userId: created.user.id,
    hasStudio: false,
  });
}
