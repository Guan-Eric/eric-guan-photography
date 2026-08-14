import { NextResponse } from "next/server";
import { listAvailableSlots } from "@/lib/availability";
import { availabilityRequestSchema } from "@/lib/booking-schema";
import { quotePackage } from "@/lib/quoting";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = availabilityRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a package and square footage first." },
      { status: 400 },
    );
  }

  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }
  const quote = quotePackage(tenant, parsed.data);
  if (!quote.ok) {
    return NextResponse.json(quote, { status: 400 });
  }

  const slots = await listAvailableSlots({
    tenantId: tenant.id,
    durationMinutes: quote.durationMinutes,
  });

  return NextResponse.json({
    ok: true,
    durationMinutes: quote.durationMinutes,
    slots,
  });
}
