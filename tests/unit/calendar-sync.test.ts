import { describe, expect, it } from "vitest";
import {
  DRIVE_BUFFER_MINUTES,
  holdIntervalsForOrder,
  isSlotFree,
} from "@/lib/availability";
import { decryptSecret, encryptSecret } from "@/lib/calendar-crypto";
import {
  createCalendarOAuthState,
  parseCalendarOAuthState,
} from "@/lib/calendar";
import {
  externalBusyFromGoogleEvents,
  googleEventInterval,
  isStudiofrontCalendarEvent,
  studiofrontEventBody,
} from "@/lib/google-calendar";

describe("requested booking holds", () => {
  it("pads every preferred slot with the drive buffer", () => {
    const start = new Date("2026-09-01T15:00:00.000Z");
    const end = new Date("2026-09-01T16:00:00.000Z");
    const altStart = new Date("2026-09-02T15:00:00.000Z");
    const altEnd = new Date("2026-09-02T16:00:00.000Z");
    const holds = holdIntervalsForOrder({
      preferredStart: start.toISOString(),
      preferredEnd: end.toISOString(),
      preferredSlotsJson: JSON.stringify([
        { start: start.toISOString(), end: end.toISOString(), label: "A" },
        { start: altStart.toISOString(), end: altEnd.toISOString(), label: "B" },
      ]),
    });
    expect(holds).toHaveLength(2);
    expect(holds[0].startsAt.toISOString()).toBe(
      new Date(start.getTime() - DRIVE_BUFFER_MINUTES * 60_000).toISOString(),
    );
    expect(holds[1].endsAt.toISOString()).toBe(
      new Date(altEnd.getTime() + DRIVE_BUFFER_MINUTES * 60_000).toISOString(),
    );
  });

  it("treats a held window as busy for a second booking", () => {
    const start = new Date("2026-09-01T15:00:00.000Z");
    const end = new Date("2026-09-01T16:00:00.000Z");
    const busy = holdIntervalsForOrder({
      preferredStart: start.toISOString(),
      preferredEnd: end.toISOString(),
      preferredSlotsJson: "[]",
    });
    expect(isSlotFree(start, end, busy)).toBe(false);
    const laterStart = new Date("2026-09-01T18:30:00.000Z");
    const laterEnd = new Date("2026-09-01T19:30:00.000Z");
    expect(isSlotFree(laterStart, laterEnd, busy)).toBe(true);
  });
});

describe("google calendar event tagging", () => {
  it("marks Studiofront events and skips them when reading external busy", () => {
    const body = studiofrontEventBody({
      summary: "Shoot — 1 Main St",
      description: "Studiofront",
      startsAt: "2026-09-01T15:00:00.000Z",
      endsAt: "2026-09-01T16:00:00.000Z",
      timeZone: "America/Toronto",
      status: "tentative",
      orderId: "ord_test",
      sourceUrl: "https://demo.localhost:3000/admin",
    });
    expect(isStudiofrontCalendarEvent(body)).toBe(true);

    const busy = externalBusyFromGoogleEvents([
      {
        ...body,
        id: "sf",
        start: body.start,
        end: body.end,
      },
      {
        id: "dentist",
        start: { dateTime: "2026-09-01T18:00:00.000Z" },
        end: { dateTime: "2026-09-01T19:00:00.000Z" },
      },
      {
        id: "free",
        transparency: "transparent",
        start: { dateTime: "2026-09-01T20:00:00.000Z" },
        end: { dateTime: "2026-09-01T21:00:00.000Z" },
      },
    ]);
    expect(busy).toHaveLength(1);
    expect(busy[0].startsAt.toISOString()).toBe("2026-09-01T18:00:00.000Z");
  });

  it("treats all-day events as a UTC date span", () => {
    const interval = googleEventInterval({
      start: { date: "2026-09-01" },
      end: { date: "2026-09-02" },
    });
    expect(interval?.startsAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(interval?.endsAt.toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });
});

describe("calendar secrets", () => {
  it("round-trips encrypted tokens", () => {
    const token = "ya29.test-refresh-token";
    const encoded = encryptSecret(token);
    expect(encoded).not.toContain(token);
    expect(decryptSecret(encoded)).toBe(token);
  });

  it("signs and verifies OAuth state", () => {
    const state = createCalendarOAuthState({
      tenantId: "demo-studio",
      userId: "usr_test",
      returnTo: "http://demo.localhost:3000/admin/schedule",
    });
    const parsed = parseCalendarOAuthState(state);
    expect(parsed?.tenantId).toBe("demo-studio");
    expect(parsed?.userId).toBe("usr_test");
    expect(parseCalendarOAuthState("tampered.sig")).toBeNull();
  });
});
