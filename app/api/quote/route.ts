import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/booking-schema";
import { quotePackage } from "@/lib/quoting";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a package and square footage." },
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

  return NextResponse.json(quote);
}
