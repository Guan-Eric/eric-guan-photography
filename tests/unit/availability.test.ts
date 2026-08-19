import { describe, expect, it } from "vitest";
import {
  DRIVE_BUFFER_MINUTES,
  getGoogleBusyIntervals,
  isSlotFree,
  wallTimeToUtc,
} from "@/lib/availability";

describe("availability helpers", () => {
  it("converts Toronto wall time to UTC", () => {
    const start = wallTimeToUtc("2026-01-15", "10:00", "America/Toronto");
    expect(start.toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });

  it("treats overlapping busy windows as taken, with drive buffer", () => {
    const start = new Date("2026-08-20T15:00:00.000Z");
    const end = new Date("2026-08-20T16:00:00.000Z");
    const busy = [
      {
        startsAt: new Date("2026-08-20T15:30:00.000Z"),
        endsAt: new Date("2026-08-20T16:30:00.000Z"),
        source: "local" as const,
      },
    ];
    expect(isSlotFree(start, end, busy, DRIVE_BUFFER_MINUTES)).toBe(false);
    expect(
      isSlotFree(
        start,
        end,
        [
          {
            startsAt: new Date("2026-08-20T18:00:00.000Z"),
            endsAt: new Date("2026-08-20T19:00:00.000Z"),
            source: "local",
          },
        ],
        0,
      ),
    ).toBe(true);
  });

  it("returns no Google busy intervals without credentials", async () => {
    expect(
      await getGoogleBusyIntervals(
        "ten_test",
        new Date("2026-08-20T00:00:00.000Z"),
        new Date("2026-08-21T00:00:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("shifts the UTC probe when the timezone day does not match", () => {
    const auckland = wallTimeToUtc("2026-01-15", "23:00", "Pacific/Auckland");
    expect(auckland.toISOString()).toBe("2026-01-15T10:00:00.000Z");
    const torontoMidnight = wallTimeToUtc("2026-01-15", "00:00", "America/Toronto");
    expect(torontoMidnight.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });

  it("logs a stub when Google calendar env is present", async () => {
    process.env.GOOGLE_CALENDAR_ID = "cal_test";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
    expect(
      await getGoogleBusyIntervals(
        "ten_test",
        new Date("2026-08-20T00:00:00.000Z"),
        new Date("2026-08-21T00:00:00.000Z"),
      ),
    ).toEqual([]);
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  });
});
