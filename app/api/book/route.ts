import { NextResponse } from "next/server";
import { bookingRequestSchema } from "@/lib/booking-schema";
import { createBooking } from "@/lib/orders";
import { rateLimitBooking } from "@/lib/request-rate-limit";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimitBooking(request);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many booking requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Check the form — something required is missing or invalid.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const tenant = await getRequestTenant();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }
  const result = await createBooking(tenant, parsed.data);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
