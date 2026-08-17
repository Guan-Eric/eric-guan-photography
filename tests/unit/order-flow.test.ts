import { describe, expect, it } from "vitest";
import { allowedManualStatuses, canSetManualStatus, confirmBlockers } from "@/lib/order-flow";

const base = {
  propertyAddress: "123 Main Street",
  postalCode: "H2X 1Y4",
  city: "Montreal",
  priceCents: 24900,
  preferredStart: "2026-08-20T14:00:00.000Z",
  preferredSlotsJson: JSON.stringify([
    {
      start: "2026-08-20T14:00:00.000Z",
      end: "2026-08-20T15:00:00.000Z",
      label: "Wed 10:00",
    },
    {
      start: "2026-08-21T14:00:00.000Z",
      end: "2026-08-21T15:00:00.000Z",
      label: "Thu 10:00",
    },
  ]),
};

describe("order status flow", () => {
  it("only allows the next status plus cancel", () => {
    expect(allowedManualStatuses("requested")).toEqual(["confirmed", "cancelled"]);
    expect(allowedManualStatuses("confirmed")).toEqual(["shot", "cancelled"]);
    expect(allowedManualStatuses("shot")).toEqual(["editing", "cancelled"]);
    expect(allowedManualStatuses("editing")).toEqual(["cancelled"]);
    expect(allowedManualStatuses("delivered")).toEqual([]);
    expect(canSetManualStatus("requested", "shot")).toBe(false);
    expect(canSetManualStatus("requested", "confirmed")).toBe(true);
  });

  it("blocks confirm until address, city, price, and time are set", () => {
    expect(confirmBlockers({ ...base, city: "" }, base.preferredStart)).toContain(
      "Confirm the city.",
    );
    expect(confirmBlockers({ ...base, priceCents: 0 }, base.preferredStart)).toContain(
      "Set a price before confirming.",
    );
    expect(confirmBlockers(base, null)).toContain("Pick which preferred time to book.");
    expect(confirmBlockers(base, base.preferredStart)).toEqual([]);
  });
});
