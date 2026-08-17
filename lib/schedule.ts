import type { DaySchedule, WeekdayKey, WeeklySchedule } from "@/lib/tenant-schema";
import { WEEKDAY_KEYS } from "@/lib/tenant-schema";

function day(enabled: boolean, open = "09:00", close = "18:00"): DaySchedule {
  return { enabled, open, close };
}

/** Matches the previous hardcoded Mon–Sat 09:00–18:00 booking window. */
export function defaultWeeklySchedule(): WeeklySchedule {
  return {
    days: {
      Mon: day(true),
      Tue: day(true),
      Wed: day(true),
      Thu: day(true),
      Fri: day(true),
      Sat: day(true),
      Sun: day(false),
    },
    slotIntervalMinutes: 30,
    leadTimeHours: 4,
    offerDays: 14,
  };
}

export function resolveSchedule(schedule?: WeeklySchedule | null): WeeklySchedule {
  if (!schedule?.days) return defaultWeeklySchedule();
  const days = { ...defaultWeeklySchedule().days };
  for (const key of WEEKDAY_KEYS) {
    const incoming = schedule.days[key];
    if (!incoming) continue;
    days[key] = {
      enabled: Boolean(incoming.enabled),
      open: normalizeHhmm(
        typeof incoming.open === "string" ? incoming.open : "09:00",
      ),
      close: normalizeHhmm(
        typeof incoming.close === "string" ? incoming.close : "18:00",
      ),
    };
  }
  return {
    days,
    slotIntervalMinutes:
      Number(schedule.slotIntervalMinutes) > 0
        ? Number(schedule.slotIntervalMinutes)
        : 30,
    leadTimeHours:
      Number(schedule.leadTimeHours) >= 0 ? Number(schedule.leadTimeHours) : 4,
    offerDays: Number(schedule.offerDays) > 0 ? Number(schedule.offerDays) : 14,
  };
}

export function weekdayLabel(key: WeekdayKey) {
  return (
    {
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
      Sun: "Sunday",
    } as const
  )[key];
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeHhmm(value: string) {
  const trimmed = value.trim();
  if (HHMM.test(trimmed)) return trimmed;
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function isValidHhmm(value: string) {
  return HHMM.test(normalizeHhmm(value));
}

/** 12-hour label for an HH:mm wall-clock string (e.g. "09:00" → "9:00 AM"). */
export function formatHhmmLabel(value: string) {
  if (!isValidHhmm(value)) return value;
  const [h, m] = normalizeHhmm(value).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Open/close options every `stepMinutes` from 00:00–23:45, plus any off-step current value. */
export function scheduleTimeOptions(
  currentValue?: string,
  stepMinutes = 15,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let min = 0; min < 24 * 60; min += stepMinutes) {
    const hour = String(Math.floor(min / 60)).padStart(2, "0");
    const minute = String(min % 60).padStart(2, "0");
    const value = `${hour}:${minute}`;
    options.push({ value, label: formatHhmmLabel(value) });
  }
  const normalized = currentValue ? normalizeHhmm(currentValue) : "";
  if (
    normalized &&
    isValidHhmm(normalized) &&
    !options.some((option) => option.value === normalized)
  ) {
    options.push({ value: normalized, label: formatHhmmLabel(normalized) });
    options.sort((a, b) => minutesFromHhmm(a.value) - minutesFromHhmm(b.value));
  }
  return options;
}

export function minutesFromHhmm(value: string) {
  const normalized = normalizeHhmm(value);
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

/** Build start-time strings from open → last start that can finish by close. */
export function startTimesForDay(
  open: string,
  close: string,
  durationMinutes: number,
  intervalMinutes: number,
) {
  if (!isValidHhmm(open) || !isValidHhmm(close)) return [];
  const openMin = minutesFromHhmm(open);
  const closeMin = minutesFromHhmm(close);
  if (closeMin <= openMin) return [];
  const lastStart = closeMin - durationMinutes;
  if (lastStart < openMin) return [];

  const times: string[] = [];
  for (let min = openMin; min <= lastStart; min += intervalMinutes) {
    const hour = String(Math.floor(min / 60)).padStart(2, "0");
    const minute = String(min % 60).padStart(2, "0");
    times.push(`${hour}:${minute}`);
  }
  return times;
}
