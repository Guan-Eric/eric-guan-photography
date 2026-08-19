import { describe, expect, it } from "vitest";
import {
  defaultWeeklySchedule,
  formatHhmmLabel,
  isValidHhmm,
  minutesFromHhmm,
  normalizeHhmm,
  resolveSchedule,
  scheduleTimeOptions,
  startTimesForDay,
  weekdayLabel,
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

  it("fills missing day times and invalid interval fields", () => {
    const resolved = resolveSchedule({
      days: {
        Mon: { enabled: true } as never,
        Tue: { enabled: false, open: 1 as never, close: 2 as never },
      } as never,
      slotIntervalMinutes: 0,
      leadTimeHours: -1,
      offerDays: 0,
    });
    expect(resolved.days.Mon.open).toBe("09:00");
    expect(resolved.days.Mon.close).toBe("18:00");
    expect(resolved.slotIntervalMinutes).toBe(30);
    expect(resolved.leadTimeHours).toBe(4);
    expect(resolved.offerDays).toBe(14);
    expect(startTimesForDay("nope", "18:00", 60, 30)).toEqual([]);
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

  it("labels weekdays and formats 12-hour times", () => {
    expect(weekdayLabel("Wed")).toBe("Wednesday");
    expect(formatHhmmLabel("09:00")).toBe("9:00 AM");
    expect(formatHhmmLabel("00:00")).toBe("12:00 AM");
    expect(formatHhmmLabel("12:15")).toBe("12:15 PM");
    expect(formatHhmmLabel("nope")).toBe("nope");
    const options = scheduleTimeOptions("09:07");
    expect(options.some((item) => item.value === "09:00")).toBe(true);
    expect(options.some((item) => item.value === "09:07")).toBe(true);
  });
});
