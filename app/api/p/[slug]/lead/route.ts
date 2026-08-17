import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { listingPageForPublic } from "@/lib/listing-pages";
import { checkRateLimit } from "@/lib/quotas";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

/** Enquiries from a published listing page go straight to the listing agent. */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const limited = checkRateLimit(`lead:${clientIp(request)}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many messages. Try again in a minute." },
      { status: 429 },
    );
  }

  const { slug } = await context.params;
  const data = await listingPageForPublic(tenant.id, slug);
  if (!data || data.page.leadCapture !== 1) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Add your name, a valid email, and a message." },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  const lines = [
    `New enquiry from ${data.page.propertyAddress}`,
    "",
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    "",
    lead.message || "(no message)",
  ].filter((line): line is string => line !== null);

  await sendEmail({
    to: data.page.agentEmail,
    subject: `Enquiry — ${data.page.propertyAddress}`,
    text: lines.join("\n"),
  });

  return NextResponse.json({ ok: true });
}

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
