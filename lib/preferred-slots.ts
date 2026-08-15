import type { TimeSlot } from "@/lib/availability";

export type PreferredSlot = {
  start: string;
  end: string;
  label: string;
};

export type DayOption = {
  key: string;
  label: string;
  slots: PreferredSlot[];
};

export const DEFAULT_SLOT_TIME_ZONE = "America/Toronto";

function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function dayLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** Compact chip label, e.g. "Sat 15". */
export function dayChipLabel(iso: string, timeZone: string = DEFAULT_SLOT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function timeOnlyLabel(iso: string, timeZone: string = DEFAULT_SLOT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Group flat availability into day buckets for the booking picker. */
export function groupSlotsByDay(
  slots: TimeSlot[],
  timeZone: string = DEFAULT_SLOT_TIME_ZONE,
): DayOption[] {
  const map = new Map<string, DayOption>();

  for (const slot of slots) {
    const key = dayKey(slot.start, timeZone);
    const existing = map.get(key);
    const preferred: PreferredSlot = {
      start: slot.start,
      end: slot.end,
      label: slot.label,
    };
    if (existing) {
      existing.slots.push(preferred);
    } else {
      map.set(key, { key, label: dayLabel(slot.start, timeZone), slots: [preferred] });
    }
  }

  return [...map.values()];
}

export function parsePreferredSlotsJson(raw: string | null | undefined): PreferredSlot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PreferredSlot[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (slot) =>
        typeof slot?.start === "string" &&
        typeof slot?.end === "string" &&
        typeof slot?.label === "string",
    );
  } catch {
    return [];
  }
}

export function formatSlotInZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
