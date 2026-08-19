import { describe, expect, it } from "vitest";
import {
  formatOpenHouse,
  parseOpenHouses,
  parseSections,
} from "@/lib/listing-content";

describe("listing-content", () => {
  it("parses valid sections and open houses", () => {
    expect(
      parseSections(
        JSON.stringify([{ heading: "Kitchen", body: "New counters." }]),
      ),
    ).toEqual([{ heading: "Kitchen", body: "New counters." }]);
    expect(
      parseOpenHouses(
        JSON.stringify([{ date: "2026-09-12", start: "2:00pm", end: "4:00pm" }]),
      ),
    ).toEqual([
      { date: "2026-09-12", start: "2:00pm", end: "4:00pm", note: "" },
    ]);
  });

  it("never throws on missing or junk JSON", () => {
    expect(parseSections(null)).toEqual([]);
    expect(parseSections("{")).toEqual([]);
    expect(parseSections(JSON.stringify([{ heading: 1 }]))).toEqual([]);
    expect(parseOpenHouses(undefined)).toEqual([]);
    expect(parseOpenHouses("not-json")).toEqual([]);
    expect(parseOpenHouses(JSON.stringify([{ date: "" }]))).toEqual([]);
  });

  it("formats an open house in the studio timezone", () => {
    const labeled = formatOpenHouse(
      { date: "2026-09-12", start: "2:00pm", end: "4:00pm", note: "By appt" },
      "America/Toronto",
    );
    expect(labeled).toMatch(/September/);
    expect(labeled).toMatch(/2:00pm–4:00pm/);
    expect(labeled).toMatch(/By appt/);
    expect(formatOpenHouse({ date: "not-a-date", start: "", end: "", note: "" })).toBe(
      "not-a-date",
    );
  });
});
