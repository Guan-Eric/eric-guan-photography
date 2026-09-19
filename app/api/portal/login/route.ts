import { NextResponse } from "next/server";
import { z } from "zod";
import { createAgentOtpChallenge } from "@/lib/agent-auth";
import { agentPortalLoginEmail, sendEmail } from "@/lib/email";
import { listOrdersByAgentEmail } from "@/lib/orders";
import { checkRateLimit } from "@/lib/quotas";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email().max(160),
  next: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }

  const limited = checkRateLimit(`portal-otp:${request.headers.get("cf-connecting-ip") ?? "ip"}`, 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many sign-in codes. Wait a minute." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const orders = await listOrdersByAgentEmail(tenant.id, email);
  if (orders.length === 0) {
    // Same generic success — no email enumeration
    return NextResponse.json({ ok: true });
  }

  const code = await createAgentOtpChallenge(tenant.id, email);
  await sendEmail(
    agentPortalLoginEmail({
      tenant,
      agentEmail: email,
      code,
    }),
  );
  return NextResponse.json({ ok: true });
}
