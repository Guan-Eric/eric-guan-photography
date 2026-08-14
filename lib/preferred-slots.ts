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

const TIME_ZONE = "America/Toronto";

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** Compact chip label, e.g. "Sat 15". */
export function dayChipLabel(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function timeOnlyLabel(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Group flat availability into day buckets for the booking picker. */
export function groupSlotsByDay(slots: TimeSlot[]): DayOption[] {
  const map = new Map<string, DayOption>();

  for (const slot of slots) {
    const key = dayKey(slot.start);
    const existing = map.get(key);
    const preferred: PreferredSlot = {
      start: slot.start,
      end: slot.end,
      label: slot.label,
    };
    if (existing) {
      existing.slots.push(preferred);
    } else {
      map.set(key, { key, label: dayLabel(slot.start), slots: [preferred] });
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
