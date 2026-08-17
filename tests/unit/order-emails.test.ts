import { describe, expect, it } from "vitest";
import {
  orderLifecycleEmails,
  orderPriceChangeEmail,
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
    for (const status of ["confirmed", "paid", "cancelled", "shot", "editing", "delivered"] as const) {
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
});
