import { and, eq, gte, lte, ne } from "drizzle-orm";
import { getExternalBusyIntervals } from "@/lib/calendar";
import { getDb, qAll, schema } from "@/lib/db";
import type { Appointment, Order } from "@/lib/db/schema";
import { parsePreferredSlotsJson } from "@/lib/preferred-slots";
import { resolveSchedule, startTimesForDay } from "@/lib/schedule";
import type { WeeklySchedule, WeekdayKey } from "@/lib/tenant-schema";
import { getTenantRow, tenantFromRow } from "@/lib/tenant-store";

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
 * Convert a wall-clock date + HH:mm in `timeZone` into a UTC Date by measuring
 * how far a UTC probe sits from the desired local wall time.
 */
export function wallTimeToUtc(
  dateYmd: string,
  hhmm: string,
  timeZone: string = TIME_ZONE,
) {
  const probe = new Date(`${dateYmd}T${hhmm}:00Z`);
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

function formatSlotLabel(start: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
}

function ymdInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekdayInZone(date: Date, timeZone: string): WeekdayKey {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
  }).format(date) as WeekdayKey;
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function paddedInterval(
  startIso: string,
  endIso: string,
  bufferMinutes = DRIVE_BUFFER_MINUTES,
): BusyInterval {
  return {
    startsAt: addMinutes(new Date(startIso), -bufferMinutes),
    endsAt: addMinutes(new Date(endIso), bufferMinutes),
    source: "local",
  };
}

export function holdIntervalsForOrder(order: Pick<
  Order,
  "preferredStart" | "preferredEnd" | "preferredSlotsJson"
>): BusyInterval[] {
  const slots = parsePreferredSlotsJson(order.preferredSlotsJson);
  const windows =
    slots.length > 0
      ? slots
      : [{ start: order.preferredStart, end: order.preferredEnd }];
  return windows
    .filter((slot) => slot.start && slot.end)
    .map((slot) => paddedInterval(slot.start, slot.end));
}

export async function getLocalBusyIntervals(
  tenantId: string,
  from: Date,
  to: Date,
  options?: { excludeOrderId?: string },
): Promise<BusyInterval[]> {
  const db = getDb();
  const appointmentFilters = [
    eq(schema.appointments.tenantId, tenantId),
    lte(schema.appointments.startsAt, to.toISOString()),
    gte(schema.appointments.endsAt, from.toISOString()),
  ];
  if (options?.excludeOrderId) {
    appointmentFilters.push(ne(schema.appointments.orderId, options.excludeOrderId));
  }

  const rows = await qAll<Appointment>(
    db
      .select()
      .from(schema.appointments)
      .where(and(...appointmentFilters)),
  );

  const busy = rows.map((row) =>
    paddedInterval(row.startsAt, row.endsAt, row.bufferMinutes),
  );

  const holdFilters = [
    eq(schema.orders.tenantId, tenantId),
    eq(schema.orders.status, "requested"),
  ];
  if (options?.excludeOrderId) {
    holdFilters.push(ne(schema.orders.id, options.excludeOrderId));
  }

  const pending = await qAll<Order>(
    db
      .select()
      .from(schema.orders)
      .where(and(...holdFilters)),
  );

  const fromMs = from.getTime();
  const toMs = to.getTime();
  for (const order of pending) {
    for (const interval of holdIntervalsForOrder(order)) {
      if (interval.startsAt.getTime() <= toMs && interval.endsAt.getTime() >= fromMs) {
        busy.push(interval);
      }
    }
  }

  return busy;
}

export async function getGoogleBusyIntervals(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<BusyInterval[]> {
  return getExternalBusyIntervals(tenantId, from, to);
}

export async function getBusyIntervals(
  tenantId: string,
  from: Date,
  to: Date,
  options?: { excludeOrderId?: string },
) {
  const [local, google] = await Promise.all([
    getLocalBusyIntervals(tenantId, from, to, options),
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

async function scheduleForTenant(tenantId: string): Promise<{
  schedule: WeeklySchedule;
  timeZone: string;
}> {
  const row = await getTenantRow(tenantId);
  if (!row) {
    return { schedule: resolveSchedule(null), timeZone: TIME_ZONE };
  }
  const tenant = tenantFromRow(row);
  return {
    schedule: resolveSchedule(tenant.schedule),
    timeZone: row.timezone || TIME_ZONE,
  };
}

/**
 * Offer shoot slots from the studio weekly schedule in the tenant timezone.
 * Applies lead time and drive-time buffer against confirmed appointments,
 * requested holds, and (when enabled) Google Calendar events.
 */
export async function listAvailableSlots(options: {
  tenantId: string;
  durationMinutes: number;
  days?: number;
  schedule?: WeeklySchedule;
  timeZone?: string;
}) {
  const resolved = await scheduleForTenant(options.tenantId);
  const schedule = options.schedule
    ? resolveSchedule(options.schedule)
    : resolved.schedule;
  const timeZone = options.timeZone ?? resolved.timeZone;
  const days = options.days ?? schedule.offerDays;
  const now = new Date();
  const rangeEnd = addMinutes(now, days * 24 * 60);
  const busy = await getBusyIntervals(options.tenantId, now, rangeEnd);
  const slots: TimeSlot[] = [];
  const leadMs = schedule.leadTimeHours * 60 * 60_000;

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const dayAnchor = addMinutes(now, dayOffset * 24 * 60);
    const ymd = ymdInZone(dayAnchor, timeZone);
    const weekday = weekdayInZone(wallTimeToUtc(ymd, "12:00", timeZone), timeZone);
    const day = schedule.days[weekday];
    if (!day?.enabled) continue;

    const startTimes = startTimesForDay(
      day.open,
      day.close,
      options.durationMinutes,
      schedule.slotIntervalMinutes,
    );

    for (const hhmm of startTimes) {
      const start = wallTimeToUtc(ymd, hhmm, timeZone);
      const end = addMinutes(start, options.durationMinutes);
      if (start.getTime() - now.getTime() < leadMs) continue;
      if (!isSlotFree(start, end, busy)) continue;

      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: formatSlotLabel(start, timeZone),
      });
    }
  }

  return slots;
}

export async function assertSlotAvailable(options: {
  tenantId: string;
  startIso: string;
  endIso: string;
  excludeOrderId?: string;
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
    { excludeOrderId: options.excludeOrderId },
  );

  if (!isSlotFree(start, end, busy)) {
    return {
      ok: false as const,
      error:
        "That slot is no longer free (another shoot, a held request, or the travel buffer). Pick another time.",
    };
  }

  return { ok: true as const };
}
