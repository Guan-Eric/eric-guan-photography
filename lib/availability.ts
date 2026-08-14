import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** Minutes of travel cushion required between any two shoots. */
export const DRIVE_BUFFER_MINUTES = 45;

export type BusyInterval = {
  startsAt: Date;
  endsAt: Date;
  source: "local" | "google";
};

export type TimeSlot = {
  start: string;
  end: string;
  label: string;
};

export const TIME_ZONE = "America/Toronto";

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Convert a Montréal wall-clock date + HH:mm into a UTC Date by measuring
 * how far a UTC probe sits from the desired local wall time.
 */
export function wallTimeToUtc(dateYmd: string, hhmm: string) {
  const probe = new Date(`${dateYmd}T${hhmm}:00Z`);
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(probe);

  const gotHour = Number(local.find((part) => part.type === "hour")?.value);
  const gotMinute = Number(local.find((part) => part.type === "minute")?.value);
  const gotDay = local.find((part) => part.type === "day")?.value ?? "";
  const wantedHour = Number(hhmm.slice(0, 2));
  const wantedMinute = Number(hhmm.slice(3, 5));
  const wantedDay = dateYmd.slice(8, 10);

  let deltaMinutes = wantedHour * 60 + wantedMinute - (gotHour * 60 + gotMinute);
  if (gotDay !== wantedDay) {
    deltaMinutes += gotDay > wantedDay ? -24 * 60 : 24 * 60;
  }

  return addMinutes(probe, deltaMinutes);
}

function formatSlotLabel(start: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
}

function ymdInZone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekdayInZone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date);
}

function localHourMinute(date: Date) {
  const label = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const [hour, minute] = label.split(":").map(Number);
  return { hour, minute };
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getLocalBusyIntervals(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<BusyInterval[]> {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.tenantId, tenantId),
        lte(schema.appointments.startsAt, to.toISOString()),
        gte(schema.appointments.endsAt, from.toISOString()),
      ),
    )
    .all();

  return rows.map((row) => ({
    startsAt: addMinutes(new Date(row.startsAt), -row.bufferMinutes),
    endsAt: addMinutes(new Date(row.endsAt), row.bufferMinutes),
    source: "local" as const,
  }));
}

/**
 * Google Calendar free/busy stub. Returns [] until GOOGLE_CALENDAR_ID and
 * GOOGLE_SERVICE_ACCOUNT_JSON are set and the freeBusy call is wired.
 */
export async function getGoogleBusyIntervals(
  _tenantId: string,
  _from: Date,
  _to: Date,
): Promise<BusyInterval[]> {
  if (!process.env.GOOGLE_CALENDAR_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return [];
  }
  console.info("[calendar] Google credentials present but freeBusy not wired yet.");
  return [];
}

export async function getBusyIntervals(tenantId: string, from: Date, to: Date) {
  const [local, google] = await Promise.all([
    getLocalBusyIntervals(tenantId, from, to),
    getGoogleBusyIntervals(tenantId, from, to),
  ]);
  return [...local, ...google];
}

export function isSlotFree(
  start: Date,
  end: Date,
  busy: BusyInterval[],
  bufferMinutes = DRIVE_BUFFER_MINUTES,
) {
  const paddedStart = addMinutes(start, -bufferMinutes);
  const paddedEnd = addMinutes(end, bufferMinutes);
  return !busy.some((interval) =>
    intervalsOverlap(paddedStart, paddedEnd, interval.startsAt, interval.endsAt),
  );
}

/**
 * Offer shoot slots for the next `days` days.
 * Mon–Sat, 09:00–16:30 starts, finish by 18:00 America/Toronto.
 * Requires 4 hours lead time. Applies drive-time buffer against existing jobs.
 */
export async function listAvailableSlots(options: {
  tenantId: string;
  durationMinutes: number;
  days?: number;
}) {
  const days = options.days ?? 14;
  const now = new Date();
  const rangeEnd = addMinutes(now, days * 24 * 60);
  const busy = await getBusyIntervals(options.tenantId, now, rangeEnd);
  const slots: TimeSlot[] = [];
  const startTimes = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30",
  ];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const dayAnchor = addMinutes(now, dayOffset * 24 * 60);
    const ymd = ymdInZone(dayAnchor);
    if (weekdayInZone(wallTimeToUtc(ymd, "12:00")) === "Sun") continue;

    for (const hhmm of startTimes) {
      const start = wallTimeToUtc(ymd, hhmm);
      const end = addMinutes(start, options.durationMinutes);
      const endHm = localHourMinute(end);
      if (endHm.hour > 18 || (endHm.hour === 18 && endHm.minute > 0)) continue;
      if (start.getTime() - now.getTime() < 4 * 60 * 60_000) continue;
      if (!isSlotFree(start, end, busy)) continue;

      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: formatSlotLabel(start),
      });
    }
  }

  return slots;
}

export async function assertSlotAvailable(options: {
  tenantId: string;
  startIso: string;
  endIso: string;
}) {
  const start = new Date(options.startIso);
  const end = new Date(options.endIso);
  if (!(start < end) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false as const, error: "Invalid time window." };
  }

  const busy = await getBusyIntervals(
    options.tenantId,
    addMinutes(start, -DRIVE_BUFFER_MINUTES),
    addMinutes(end, DRIVE_BUFFER_MINUTES),
  );

  if (!isSlotFree(start, end, busy)) {
    return {
      ok: false as const,
      error:
        "That slot is no longer free (another shoot or the travel buffer). Pick another time.",
    };
  }

  return { ok: true as const };
}
