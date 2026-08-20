/** Studio wall-clock timezones — full IANA set via Intl when available. */

export const DEFAULT_STUDIO_TIMEZONE = "America/Toronto";

const FALLBACK_TIMEZONES = [
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Argentina/Buenos_Aires",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Pacific/Auckland",
  "UTC",
] as const;

/** Stable option list for selects (same on server and client). */
export function listTimeZones(): string[] {
  return [...FALLBACK_TIMEZONES];
}

export function isValidTimeZone(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(
  value: unknown,
  fallback = DEFAULT_STUDIO_TIMEZONE,
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return isValidTimeZone(trimmed) ? trimmed : fallback;
}

export function timeZoneLabel(zone: string): string {
  return zone.replace(/_/g, " ");
}
