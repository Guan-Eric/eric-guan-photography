import { describe, expect, it } from "vitest";
import {
  defaultWeeklySchedule,
  isValidHhmm,
  minutesFromHhmm,
  normalizeHhmm,
  resolveSchedule,
  startTimesForDay,
} from "@/lib/schedule";

describe("schedule", () => {
  it("normalizes and validates HH:mm", () => {
    expect(normalizeHhmm("9:30")).toBe("09:30");
    expect(normalizeHhmm("09:30")).toBe("09:30");
    expect(isValidHhmm("09:30")).toBe(true);
    expect(isValidHhmm("25:00")).toBe(false);
    expect(minutesFromHhmm("09:30")).toBe(570);
  });

  it("defaults Mon–Sat open with Sunday off", () => {
    const schedule = defaultWeeklySchedule();
    expect(schedule.days.Mon.enabled).toBe(true);
    expect(schedule.days.Sun.enabled).toBe(false);
    expect(schedule.slotIntervalMinutes).toBe(30);
    expect(schedule.leadTimeHours).toBe(4);
  });

  it("merges partial schedules via resolveSchedule", () => {
    const resolved = resolveSchedule({
      days: {
        Mon: { enabled: true, open: "10:00", close: "12:00" },
      } as never,
      slotIntervalMinutes: 15,
      leadTimeHours: 2,
      offerDays: 7,
    });
    expect(resolved.days.Mon.open).toBe("10:00");
    expect(resolved.days.Mon.close).toBe("12:00");
    expect(resolved.slotIntervalMinutes).toBe(15);
    expect(resolved.days.Tue.enabled).toBe(true);
  });

  it("builds start times that finish by close", () => {
    expect(startTimesForDay("09:00", "11:00", 60, 30)).toEqual([
      "09:00",
      "09:30",
      "10:00",
    ]);
    expect(startTimesForDay("09:00", "09:30", 60, 30)).toEqual([]);
    expect(startTimesForDay("18:00", "09:00", 60, 30)).toEqual([]);
  });
});
