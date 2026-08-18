import { describe, expect, it } from "vitest";
import {
  bookingRequestSchema,
  quoteRequestSchema,
  statusUpdateSchema,
} from "@/lib/booking-schema";

const slot = {
  start: "2026-08-20T14:00:00.000Z",
  end: "2026-08-20T15:00:00.000Z",
  label: "Wed 10:00",
};

describe("booking-schema", () => {
  it("accepts valid quote and booking payloads", () => {
    expect(
      quoteRequestSchema.safeParse({
        packageId: "standard",
        squareFootage: 1500,
      }).success,
    ).toBe(true);

    const booking = bookingRequestSchema.safeParse({
      packageId: "standard",
      squareFootage: 1500,
      propertyAddress: "123 Main Street",
      postalCode: "H2X 1Y4",
      preferredSlots: [slot],
      agentName: "Alex Agent",
      agentEmail: "alex@example.com",
      occupancy: "vacant",
      accessType: "lockbox",
    });
    expect(booking.success).toBe(true);

    const usZip = bookingRequestSchema.safeParse({
      packageId: "standard",
      squareFootage: 1500,
      propertyAddress: "123 Main Street",
      postalCode: "10001",
      preferredSlots: [slot],
      agentName: "Alex Agent",
      agentEmail: "alex@example.com",
      occupancy: "vacant",
      accessType: "lockbox",
    });
    expect(usZip.success).toBe(true);
  });

  it("rejects invalid booking fixtures", () => {
    expect(
      quoteRequestSchema.safeParse({
        packageId: "standard",
        squareFootage: 50,
      }).success,
    ).toBe(false);
    expect(
      bookingRequestSchema.safeParse({
        packageId: "standard",
        squareFootage: 1500,
        propertyAddress: "x",
        postalCode: "H2X",
        preferredSlots: [],
        agentName: "A",
        agentEmail: "not-an-email",
        occupancy: "vacant",
        accessType: "lockbox",
      }).success,
    ).toBe(false);
    expect(statusUpdateSchema.safeParse({ status: "nope" }).success).toBe(
      false,
    );
    expect(statusUpdateSchema.safeParse({ status: "confirmed" }).success).toBe(
      true,
    );
    expect(statusUpdateSchema.safeParse({ status: "delivered" }).success).toBe(
      false,
    );
    expect(statusUpdateSchema.safeParse({ status: "paid" }).success).toBe(
      false,
    );
    expect(statusUpdateSchema.safeParse({ priceCents: 20000 }).success).toBe(
      true,
    );
    expect(statusUpdateSchema.safeParse({}).success).toBe(false);
  });
});
