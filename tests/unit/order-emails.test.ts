import { describe, expect, it } from "vitest";
import {
  orderLifecycleEmails,
  orderPriceChangeEmail,
  photographerNotifyEmail,
  photographerOrderStatusEmail,
} from "@/lib/email";
import type { Order } from "@/lib/db/schema";
import type { Tenant } from "@/lib/tenant-schema";

const tenant = {
  id: "ten_test",
  slug: "test",
  domain: null,
  studioName: "Test Studio",
  photographerName: "Pat Photographer",
  email: "photo@example.com",
  siteUrl: "https://test.studiofront.ca",
} as Tenant;

const order = {
  id: "ord_1",
  tenantId: "ten_test",
  status: "confirmed",
  packageName: "Standard",
  priceCents: 25000,
  currency: "CAD",
  propertyAddress: "12 Main St",
  agentName: "Alex Agent",
  agentEmail: "agent@example.com",
} as Order;

describe("order lifecycle emails", () => {
  it("sends agent + photographer mail for confirmed/paid/cancelled", () => {
    for (const status of [
      "confirmed",
      "paid",
      "cancelled",
      "shot",
      "editing",
      "delivered",
    ] as const) {
      const mails = orderLifecycleEmails({ tenant, order, status });
      expect(mails.length).toBe(2);
      expect(mails.map((mail) => mail.to).sort()).toEqual([
        "agent@example.com",
        "photo@example.com",
      ]);
    }
  });

  it("includes schedule on confirmed agent mail", () => {
    const mail = orderLifecycleEmails({
      tenant,
      order,
      status: "confirmed",
      scheduledLabel: "Tue, Apr 1, 10:00 a.m. – 11:00 a.m.",
    })[0];
    expect(mail.text).toMatch(/Scheduled/);
    expect(mail.text).toMatch(/Tue, Apr 1/);
  });

  it("emails both parties on price change", () => {
    const agent = orderPriceChangeEmail({
      tenant,
      order,
      previousPriceLabel: "$200.00",
      nextPriceLabel: "$250.00",
    });
    const photo = photographerOrderStatusEmail({
      tenant,
      order,
      status: "paid",
    });
    expect(agent.to).toBe("agent@example.com");
    expect(agent.text).toMatch(/Updated quote/);
    expect(photo?.to).toBe("photo@example.com");
  });

  it("includes access and agent details on new booking notify", () => {
    const mail = photographerNotifyEmail({
      tenant,
      orderId: "ord_1",
      agentName: "Alex Agent",
      agentEmail: "agent@example.com",
      agentPhone: "416-555-0100",
      brokerage: "North Realty",
      propertyAddress: "12 Main St",
      city: "Toronto",
      postalCode: "M5V 1A1",
      packageName: "Standard",
      priceLabel: "$200",
      slotLabel: "Tue 10:00",
      squareFootage: 1800,
      occupancy: "occupied",
      accessType: "lockbox",
      accessNotes: "Code 1234",
      pets: "Dog in backyard",
      parkingNotes: "Street parking",
      meetingContact: "Call Alex on arrival",
      notes: "Focus on kitchen",
      adminUrl: "https://test.studiofront.ca/admin",
    });
    expect(mail.to).toBe("photo@example.com");
    expect(mail.text).toMatch(/416-555-0100/);
    expect(mail.text).toMatch(/North Realty/);
    expect(mail.text).toMatch(/Code 1234/);
    expect(mail.text).toMatch(/Dog in backyard/);
    expect(mail.text).toMatch(/Street parking/);
    expect(mail.text).toMatch(/Call Alex on arrival/);
    expect(mail.text).toMatch(/Focus on kitchen/);
  });
});
