import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAddressComponents, placesApiKey } from "@/lib/places";
import { checkRateLimit } from "@/lib/quotas";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const bodySchema = z.object({
  placeId: z.string().trim().min(4).max(256),
  sessionToken: z.string().trim().min(8).max(80),
});

export async function POST(request: Request) {
  if (!placesApiKey()) {
    return NextResponse.json({ ok: false, disabled: true });
  }

  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (origin) {
    try {
      const from = new URL(origin).hostname.toLowerCase();
      const host = (
        request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        ""
      )
        .split(":")[0]
        .toLowerCase();
      if (from !== host && !from.endsWith(`.${host}`) && !host.endsWith(`.${from}`)) {
        return NextResponse.json({ ok: false, error: "Bad origin." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Bad origin." }, { status: 403 });
    }
  }

  const limited = checkRateLimit(`geo:${clientIp(request)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many lookups. Try again in a minute." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Pick an address from the list." }, { status: 400 });
  }

  await getRequestTenant();

  const placeId = parsed.data.placeId.replace(/^places\//, "");
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("sessionToken", parsed.data.sessionToken);

  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": placesApiKey(),
      "X-Goog-FieldMask":
        "id,formattedAddress,shortFormattedAddress,addressComponents,location",
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("[places] details failed", response.status, detail);
    return NextResponse.json({ ok: false, error: "Could not resolve that address." }, { status: 502 });
  }

  const json = (await response.json()) as {
    id?: string;
    formattedAddress?: string;
    shortFormattedAddress?: string;
    addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    location?: { latitude?: number; longitude?: number };
  };

  const address = parseAddressComponents(json.addressComponents ?? [], {
    placeId,
    formatted: json.shortFormattedAddress ?? json.formattedAddress,
    lat: json.location?.latitude,
    lng: json.location?.longitude,
  });

  if (!address.line1) {
    return NextResponse.json({ ok: false, error: "That place has no street address." }, { status: 422 });
  }

  return NextResponse.json({ ok: true, address });
}

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
