import { NextResponse } from "next/server";
import { z } from "zod";
import { placesApiKey, regionCodesForGate } from "@/lib/places";
import { checkRateLimit } from "@/lib/quotas";
import { getRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().trim().min(3).max(120),
  sessionToken: z.string().trim().min(8).max(80),
});

export async function POST(request: Request) {
  const disabled = disabledResponse();
  if (disabled) return disabled;

  const origin = sameHostOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ ok: false, error: "Bad origin." }, { status: 403 });
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
    return NextResponse.json({ ok: false, error: "Type a bit more of the address." }, { status: 400 });
  }

  const tenant = await getRequestTenant();
  const regionCodes = regionCodesForGate(tenant?.serviceAreaGate?.region);
  const key = placesApiKey();

  const payload: Record<string, unknown> = {
    input: parsed.data.query,
    sessionToken: parsed.data.sessionToken,
    languageCode: "en",
  };
  if (regionCodes.length) payload.includedRegionCodes = regionCodes;

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("[places] autocomplete failed", response.status, detail);
    return NextResponse.json({ ok: false, error: "Address lookup failed." }, { status: 502 });
  }

  const json = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        text?: { text?: string };
      };
    }>;
  };

  const suggestions = (json.suggestions ?? [])
    .map((item) => {
      const prediction = item.placePrediction;
      if (!prediction?.placeId) return null;
      return {
        placeId: prediction.placeId.replace(/^places\//, ""),
        primary: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "",
        secondary: prediction.structuredFormat?.secondaryText?.text ?? "",
      };
    })
    .filter((item): item is { placeId: string; primary: string; secondary: string } =>
      Boolean(item?.primary),
    );

  return NextResponse.json({ ok: true, suggestions });
}

function disabledResponse() {
  if (placesApiKey()) return null;
  return NextResponse.json({ ok: false, disabled: true });
}

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function sameHostOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return { ok: true };
  try {
    const from = new URL(origin).hostname.toLowerCase();
    const host = (
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      ""
    )
      .split(":")[0]
      .toLowerCase();
    if (!host) return { ok: true };
    if (from === host) return { ok: true };
    if (from.endsWith(`.${host}`) || host.endsWith(`.${from}`)) return { ok: true };
    // Tenant custom domains hit the Worker with Host=custom; allow same-site only.
    const root = (process.env.PLATFORM_ROOT_DOMAIN ?? "").toLowerCase().trim();
    if (root && (from === root || from.endsWith(`.${root}`))) return { ok: true };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
