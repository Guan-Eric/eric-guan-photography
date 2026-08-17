import { NextResponse } from "next/server";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import { normalizeStudioCurrency } from "@/lib/currency";
import {
  isValidHhmm,
  minutesFromHhmm,
  normalizeHhmm,
  resolveSchedule,
} from "@/lib/schedule";
import type {
  GalleryImage,
  ImageAsset,
  Package,
  PriceBand,
  ServiceAreaGate,
  WeekdayKey,
  WeeklySchedule,
} from "@/lib/tenant-schema";
import { WEEKDAY_KEYS } from "@/lib/tenant-schema";
import {
  parseTenantConfig,
  getTenantRow,
  updateTenantConfig,
  updateTenantTimezone,
} from "@/lib/tenant-store";
import { isValidTimeZone, normalizeTimeZone } from "@/lib/timezones";

export const runtime = "nodejs";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number | null = null) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseHero(value: unknown, fallback: ImageAsset): ImageAsset {
  if (!value || typeof value !== "object") return fallback;
  const hero = value as Record<string, unknown>;
  const src = asString(hero.src).trim();
  if (!src) return fallback;
  return {
    src,
    alt: asString(hero.alt, fallback.alt),
    width: asNumber(hero.width, fallback.width) ?? fallback.width,
    height: asNumber(hero.height, fallback.height) ?? fallback.height,
  };
}

function parseGallery(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return [];
  const images: GalleryImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const src = asString(row.src).trim();
    if (!src) continue;
    images.push({
      src,
      alt: asString(row.alt),
      width: asNumber(row.width, 1800) ?? 1800,
      height: asNumber(row.height, 1200) ?? 1200,
      room: asString(row.room),
      note: asString(row.note),
      wide: Boolean(row.wide),
    });
  }
  return images;
}

function parseBands(value: unknown): PriceBand[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const bands = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const priceCents = asNumber(row.priceCents, null);
      const maxSqft = asNumber(row.maxSqft, null);
      if (priceCents == null || maxSqft == null) return null;
      return {
        maxSqft,
        priceCents,
        label: asString(row.label) || `${maxSqft} sq ft`,
      };
    })
    .filter((item): item is PriceBand => item != null);
  return bands.length > 0 ? bands : undefined;
}

function parsePackages(value: unknown, existing: Package[]): Package[] {
  if (!Array.isArray(value)) return existing;
  const parsed: Package[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const name = asString(row.name).trim();
    if (!name) return;
    const durationRaw = asNumber(row.durationMinutes, null);
    const includes = Array.isArray(row.includes)
      ? row.includes.map((line) => String(line).trim()).filter(Boolean)
      : [];
    const cents = asNumber(row.priceCents, null);
    const durationMinutes = durationRaw && durationRaw > 0 ? durationRaw : null;
    const quoteLater = Boolean(row.quoteLater) && durationMinutes != null;
    parsed.push({
      id: asString(row.id).trim() || `pkg_${index + 1}`,
      name,
      summary: asString(row.summary),
      price: asString(row.price) || (quoteLater ? "Quote after request" : ""),
      durationMinutes,
      includes,
      featured: Boolean(row.featured),
      upsell: Boolean(row.upsell),
      quoteLater: quoteLater || undefined,
      priceCents: quoteLater ? undefined : cents ?? undefined,
      priceBands: quoteLater ? [] : parseBands(row.priceBands),
    });
  });
  return parsed;
}

function parseSchedule(
  value: unknown,
  fallback: WeeklySchedule,
): { ok: true; schedule: WeeklySchedule } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Schedule is required." };
  }
  const body = value as Record<string, unknown>;
  const daysBody =
    body.days && typeof body.days === "object"
      ? (body.days as Record<string, unknown>)
      : null;
  if (!daysBody) {
    return { ok: false, error: "Weekly hours are required." };
  }

  const days = { ...fallback.days };
  for (const key of WEEKDAY_KEYS) {
    const raw = daysBody[key];
    if (!raw || typeof raw !== "object") continue;
    const day = raw as Record<string, unknown>;
    const open = normalizeHhmm(asString(day.open, days[key].open));
    const close = normalizeHhmm(asString(day.close, days[key].close));
    if (!isValidHhmm(open) || !isValidHhmm(close)) {
      return { ok: false, error: `Invalid time on ${key}. Use HH:mm.` };
    }
    if (Boolean(day.enabled) && minutesFromHhmm(close) <= minutesFromHhmm(open)) {
      return { ok: false, error: `${key}: close must be after open.` };
    }
    days[key as WeekdayKey] = {
      enabled: Boolean(day.enabled),
      open,
      close,
    };
  }

  const interval = asNumber(body.slotIntervalMinutes, fallback.slotIntervalMinutes);
  const lead = asNumber(body.leadTimeHours, fallback.leadTimeHours);
  const offer = asNumber(body.offerDays, fallback.offerDays);
  if (interval == null || ![15, 30, 60].includes(interval)) {
    return { ok: false, error: "Slot interval must be 15, 30, or 60 minutes." };
  }
  if (lead == null || lead < 0 || lead > 72) {
    return { ok: false, error: "Lead time must be between 0 and 72 hours." };
  }
  if (offer == null || offer < 1 || offer > 60) {
    return { ok: false, error: "Offer window must be between 1 and 60 days." };
  }

  const schedule = resolveSchedule({
    days,
    slotIntervalMinutes: interval,
    leadTimeHours: lead,
    offerDays: offer,
  });

  if (!WEEKDAY_KEYS.some((key) => schedule.days[key].enabled)) {
    return { ok: false, error: "Enable at least one day." };
  }

  return { ok: true, schedule };
}

export async function PATCH(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const row = await getTenantRow(session.activeTenantId);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Studio not found." }, { status: 404 });
  }
  const current = parseTenantConfig(row);
  const body = await request.json().catch(() => null);
  const section = asString(body?.section);

  if (section === "work") {
    const photographerName = asString(body?.photographerName, current.photographerName).trim();
    const tagline = asString(body?.tagline, current.tagline).trim();
    const lede = asString(body?.lede, current.lede).trim();
    if (photographerName.length < 2 || tagline.length < 2) {
      return NextResponse.json({ ok: false, error: "Name and tagline are required." }, { status: 400 });
    }
    await updateTenantConfig(session.activeTenantId, {
      photographerName,
      tagline,
      lede,
      hero: parseHero(body?.hero, current.hero),
      gallery: parseGallery(body?.gallery),
      portfolioComplete:
        typeof body?.portfolioComplete === "boolean"
          ? body.portfolioComplete
          : current.portfolioComplete,
    });
    return NextResponse.json({ ok: true });
  }

  if (section === "pricing") {
    await updateTenantConfig(session.activeTenantId, {
      packages: parsePackages(body?.packages, current.packages),
    });
    return NextResponse.json({ ok: true });
  }

  if (section === "booking") {
    const gateBody = body?.serviceAreaGate;
    const gate: ServiceAreaGate = {
      enabled: Boolean(gateBody?.enabled),
      region:
        gateBody?.region === "US" || gateBody?.region === "CA" ? gateBody.region : "none",
      prefixes: String(gateBody?.prefixes ?? "")
        .split(",")
        .map((item: string) => item.trim().toUpperCase())
        .filter(Boolean),
      message:
        asString(gateBody?.message).trim() ||
        current.serviceAreaGate?.message ||
        "This studio does not currently cover that area.",
    };
    const email = asString(body?.email, current.email).trim().toLowerCase();
    if (!email.includes("@")) {
      return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
    }
    const phone = asString(body?.phone).trim();
    const currency = normalizeStudioCurrency(
      body?.currency,
      normalizeStudioCurrency(current.seo.currency),
    );
    await updateTenantConfig(session.activeTenantId, {
      turnaround: asString(body?.turnaround, current.turnaround).trim() || current.turnaround,
      email,
      phone: phone || null,
      serviceAreaGate: gate,
      seo: {
        ...current.seo,
        currency,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (section === "schedule") {
    const parsed = parseSchedule(body?.schedule, resolveSchedule(current.schedule));
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const timezone = normalizeTimeZone(
      asString(body?.timezone, row.timezone),
      normalizeTimeZone(row.timezone),
    );
    if (!isValidTimeZone(timezone)) {
      return NextResponse.json({ ok: false, error: "Pick a valid timezone." }, { status: 400 });
    }
    await updateTenantConfig(session.activeTenantId, { schedule: parsed.schedule });
    await updateTenantTimezone(session.activeTenantId, timezone);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown section." }, { status: 400 });
}
