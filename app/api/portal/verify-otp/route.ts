import { NextResponse } from "next/server";
import { z } from "zod";
import { attachAgentSession, verifyAgentOtpChallenge } from "@/lib/agent-auth";
import { listOrdersByAgentEmail } from "@/lib/orders";
import { safePortalPath } from "@/lib/platform";
import { checkRateLimit } from "@/lib/quotas";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email().max(160),
  code: z.string().trim().regex(/^\d{6}$/),
  next: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }

  const limited = checkRateLimit(
    `portal-verify:${request.headers.get("cf-connecting-ip") ?? "ip"}`,
    20,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Wait a minute." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const orders = await listOrdersByAgentEmail(tenant.id, email);
  if (orders.length === 0) {
    return NextResponse.json({ ok: false, error: "That code is incorrect or expired." }, { status: 400 });
  }

  const result = await verifyAgentOtpChallenge(tenant.id, email, parsed.data.code);
  if (!result.ok) {
    const message =
      result.error === "locked"
        ? "Too many incorrect attempts. Request a new code."
        : result.error === "expired"
          ? "That code expired. Request a new one."
          : "That code is incorrect or expired.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const next = safePortalPath(parsed.data.next) ?? "/portal";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const response = NextResponse.json({ ok: true, redirectTo: next });
  await attachAgentSession(response, result.session, host);
  return response;
}
