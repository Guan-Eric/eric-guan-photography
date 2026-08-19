import { describe, expect, it } from "vitest";
import {
  dayChipLabel,
  formatSlotInZone,
  groupSlotsByDay,
  parsePreferredSlotsJson,
  timeOnlyLabel,
} from "@/lib/preferred-slots";

describe("preferred-slots", () => {
  it("parses valid preferred slot JSON and rejects junk", () => {
    const raw = JSON.stringify([
      {
        start: "2026-08-20T14:00:00.000Z",
        end: "2026-08-20T15:00:00.000Z",
        label: "Wed 10:00",
      },
      { start: 1, end: "x", label: "bad" },
    ]);
    expect(parsePreferredSlotsJson(raw)).toHaveLength(1);
    expect(parsePreferredSlotsJson("{")).toEqual([]);
    expect(parsePreferredSlotsJson(null)).toEqual([]);
    expect(parsePreferredSlotsJson("[]")).toEqual([]);
    expect(parsePreferredSlotsJson(JSON.stringify({ start: "x" }))).toEqual([]);
  });

  it("groups availability slots by calendar day", () => {
    const days = groupSlotsByDay(
      [
        {
          start: "2026-08-20T14:00:00.000Z",
          end: "2026-08-20T15:00:00.000Z",
          label: "a",
        },
        {
          start: "2026-08-20T16:00:00.000Z",
          end: "2026-08-20T17:00:00.000Z",
          label: "b",
        },
        {
          start: "2026-08-21T14:00:00.000Z",
          end: "2026-08-21T15:00:00.000Z",
          label: "c",
        },
      ],
      "America/Toronto",
    );
    expect(days).toHaveLength(2);
    expect(days[0]!.slots).toHaveLength(2);
    expect(days[1]!.slots).toHaveLength(1);
  });

  it("formats compact chip and time labels", () => {
    const iso = "2026-08-20T14:00:00.000Z";
    expect(dayChipLabel(iso, "America/Toronto")).toMatch(/\d/);
    expect(timeOnlyLabel(iso, "America/Toronto")).toMatch(/\d/);
    expect(formatSlotInZone(iso, "America/Toronto")).toMatch(/August/);
  });
});
