import { and, desc, eq } from "drizzle-orm";
import {
  assertSlotAvailable,
  DRIVE_BUFFER_MINUTES,
} from "@/lib/availability";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { Appointment, Order, OrderStatus } from "@/lib/db/schema";
import { ORDER_STATUSES } from "@/lib/db/schema";
import {
  bookingConfirmationEmail,
  newAppointmentId,
  newOrderId,
  newPublicToken,
  photographerNotifyEmail,
  sendEmail,
} from "@/lib/email";
import type { PreferredSlot } from "@/lib/preferred-slots";
import { quotePackage } from "@/lib/quoting";
import {
  formatPostalCode,
  isInServiceArea,
  isValidPostalForTenant,
  normalizePostalCode,
  serviceAreaMessage,
} from "@/lib/service-area";
import {
  assertCanCreateListing,
  incrementListingUsage,
} from "@/lib/billing";
import type { Tenant } from "@/lib/tenant-schema";

export type BookingInput = {
  packageId: string;
  squareFootage: number;
  propertyAddress: string;
  postalCode: string;
  city?: string;
  placeId?: string;
  mapLat?: string;
  mapLng?: string;
  referralCode?: string;
  preferredSlots: PreferredSlot[];
  agentName: string;
  agentEmail: string;
  agentPhone?: string;
  brokerage?: string;
  occupancy: "vacant" | "occupied";
  accessType: "lockbox" | "meet" | "key" | "other";
  accessNotes?: string;
  pets?: string;
  parkingNotes?: string;
  meetingContact?: string;
  notes?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function createBooking(tenant: Tenant, input: BookingInput) {
  const quota = await assertCanCreateListing(tenant.id);
  if (!quota.ok) return quota;

  const postal = normalizePostalCode(input.postalCode);
  if (!isValidPostalForTenant(postal, tenant)) {
    return { ok: false as const, error: "Enter a valid postal or ZIP code." };
  }
  if (!isInServiceArea(postal, tenant)) {
    return { ok: false as const, error: serviceAreaMessage(tenant) };
  }

  const quote = quotePackage(tenant, {
    packageId: input.packageId,
    squareFootage: input.squareFootage,
  });
  if (!quote.ok) {
    return { ok: false as const, error: quote.error, contactOnly: quote.contactOnly };
  }

  if (!input.preferredSlots.length || input.preferredSlots.length > 3) {
    return {
      ok: false as const,
      error: "Pick 1 to 3 preferred times.",
    };
  }

  for (const slot of input.preferredSlots) {
    const available = await assertSlotAvailable({
      tenantId: tenant.id,
      startIso: slot.start,
      endIso: slot.end,
    });
    if (!available.ok) {
      return {
        ok: false as const,
        error: `${slot.label} is no longer free. Remove it and pick another.`,
      };
    }

    const expectedEnd = new Date(
      new Date(slot.start).getTime() + quote.durationMinutes * 60_000,
    ).toISOString();
    if (Math.abs(new Date(slot.end).getTime() - new Date(expectedEnd).getTime()) > 60_000) {
      return {
        ok: false as const,
        error: "A selected slot does not match the quoted shoot duration. Refresh and try again.",
      };
    }
  }

  const primary = input.preferredSlots[0];
  const id = newOrderId();
  const publicToken = newPublicToken();
  const createdAt = nowIso();
  const db = getDb();

  const orderRow = {
    id,
    tenantId: tenant.id,
    status: "requested" as const,
    packageId: quote.packageId,
    packageName: quote.packageName,
    priceCents: quote.priceCents,
    currency: quote.currency,
    durationMinutes: quote.durationMinutes,
    squareFootage: quote.squareFootage,
    propertyAddress: input.propertyAddress.trim(),
    postalCode: formatPostalCode(postal),
    city: input.city?.trim() || null,
    preferredStart: primary.start,
    preferredEnd: primary.end,
    preferredSlotsJson: JSON.stringify(input.preferredSlots),
    agentName: input.agentName.trim(),
    agentEmail: input.agentEmail.trim().toLowerCase(),
    agentPhone: input.agentPhone?.trim() || null,
    brokerage: input.brokerage?.trim() || null,
    occupancy: input.occupancy,
    accessType: input.accessType,
    accessNotes: input.accessNotes?.trim() || null,
    pets: input.pets?.trim() || null,
    parkingNotes: input.parkingNotes?.trim() || null,
    meetingContact: input.meetingContact?.trim() || null,
    notes: input.notes?.trim() || null,
    placeId: input.placeId?.trim() || null,
    mapLat: input.mapLat?.trim() || null,
    mapLng: input.mapLng?.trim() || null,
    publicToken,
    createdAt,
    updatedAt: createdAt,
  };

  await qRun(db.insert(schema.orders).values(orderRow));
  await incrementListingUsage(tenant.id);
  const { applyReferralOnBooking } = await import("@/lib/referrals");
  await applyReferralOnBooking({
    tenantId: tenant.id,
    orderId: id,
    agentEmail: orderRow.agentEmail,
    referralCode: input.referralCode,
    currency: quote.currency,
  });

  // Preferences are not calendar holds. The appointment is created when you
  // mark the order confirmed, using the primary preferred slot.
  // Always link into this studio’s host — not the platform apex SITE_URL.
  const siteBase = tenant.siteUrl.replace(/\/$/, "");
  const confirmationUrl = `${siteBase}/book/confirmation/${id}?token=${publicToken}`;
  const adminUrl = `${siteBase}/admin`;
  const slotLabel = input.preferredSlots.map((slot) => slot.label).join(" · ");

  await sendEmail(
    bookingConfirmationEmail({
      tenant,
      agentName: orderRow.agentName,
      agentEmail: orderRow.agentEmail,
      propertyAddress: orderRow.propertyAddress,
      packageName: orderRow.packageName,
      priceLabel: quote.priceLabel,
      slotLabel,
      confirmationUrl,
    }),
  );

  await sendEmail(
    photographerNotifyEmail({
      tenant,
      orderId: id,
      agentName: orderRow.agentName,
      agentEmail: orderRow.agentEmail,
      propertyAddress: orderRow.propertyAddress,
      packageName: orderRow.packageName,
      priceLabel: quote.priceLabel,
      slotLabel,
      adminUrl,
    }),
  );

  return {
    ok: true as const,
    orderId: id,
    publicToken,
    confirmationUrl,
    quote,
    emailStubbed: !process.env.RESEND_API_KEY,
  };
}

export async function listOrders(tenantId: string): Promise<Order[]> {
  const db = getDb();
  return qAll<Order>(
    db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.tenantId, tenantId))
      .orderBy(desc(schema.orders.createdAt)),
  );
}

export async function listOrdersByAgentEmail(tenantId: string, email: string) {
  const db = getDb();
  return qAll<Order>(
    db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.tenantId, tenantId),
          eq(schema.orders.agentEmail, email.trim().toLowerCase()),
        ),
      )
      .orderBy(desc(schema.orders.createdAt)),
  );
}

export async function listTodayAppointments(tenantId: string, timezone: string) {
  const db = getDb();
  const rows = await qAll<Appointment>(
    db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.tenantId, tenantId)),
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return rows.filter((row) => {
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(row.startsAt));
    return local === today;
  });
}

export async function markAppointmentMilestone(
  tenantId: string,
  appointmentId: string,
  field: "onMyWayAt" | "arrivedAt" | "completedAt",
) {
  const db = getDb();
  const row =
    (await qGet<Appointment>(
      db.select().from(schema.appointments).where(eq(schema.appointments.id, appointmentId)),
    )) ?? null;
  if (!row || row.tenantId !== tenantId) {
    return { ok: false as const, error: "Appointment not found." };
  }
  const stamp = nowIso();
  await qRun(
    db
      .update(schema.appointments)
      .set({ [field]: stamp })
      .where(eq(schema.appointments.id, appointmentId)),
  );
  return { ok: true as const, appointment: { ...row, [field]: stamp } };
}

export async function getOrder(orderId: string, tenantId?: string) {
  const db = getDb();
  const order =
    (await qGet<Order>(
      db.select().from(schema.orders).where(eq(schema.orders.id, orderId)),
    )) ?? null;
  if (!order) return null;
  if (tenantId && order.tenantId !== tenantId) return null;
  return order;
}

export async function getOrderForPublic(orderId: string, token: string) {
  const order = await getOrder(orderId);
  if (!order || order.publicToken !== token) return null;
  return order;
}

async function ensureAppointmentForOrder(order: Order) {
  const db = getDb();
  const existing = await qGet<Appointment>(
    db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.orderId, order.id)),
  );

  if (existing) return;

  await qRun(
    db.insert(schema.appointments).values({
      id: newAppointmentId(),
      tenantId: order.tenantId,
      orderId: order.id,
      startsAt: order.preferredStart,
      endsAt: order.preferredEnd,
      bufferMinutes: DRIVE_BUFFER_MINUTES,
      postalCode: order.postalCode,
      createdAt: nowIso(),
    }),
  );
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  tenantId?: string,
) {
  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false as const, error: "Unknown status." };
  }

  const db = getDb();
  const existing = await getOrder(orderId, tenantId);
  if (!existing) return { ok: false as const, error: "Order not found." };

  await qRun(
    db
      .update(schema.orders)
      .set({ status, updatedAt: nowIso() })
      .where(eq(schema.orders.id, orderId)),
  );

  if (status === "cancelled") {
    await qRun(
      db.delete(schema.appointments).where(eq(schema.appointments.orderId, orderId)),
    );
  } else if (status === "confirmed") {
    await ensureAppointmentForOrder(existing);
  }

  return { ok: true as const, order: (await getOrder(orderId, tenantId))! };
}

export async function updateOrderPrice(
  orderId: string,
  priceCents: number,
  tenantId?: string,
) {
  if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 5_000_000) {
    return { ok: false as const, error: "Enter a valid price." };
  }

  const existing = await getOrder(orderId, tenantId);
  if (!existing) return { ok: false as const, error: "Order not found." };

  const rounded = Math.round(priceCents);
  const db = getDb();
  await qRun(
    db
      .update(schema.orders)
      .set({ priceCents: rounded, updatedAt: nowIso() })
      .where(eq(schema.orders.id, orderId)),
  );

  await qRun(
    db
      .update(schema.galleries)
      .set({ amountCents: rounded, updatedAt: nowIso() })
      .where(eq(schema.galleries.orderId, orderId)),
  );

  return { ok: true as const, order: (await getOrder(orderId, tenantId))! };
}

export async function updateOrderAddress(
  orderId: string,
  input: {
    propertyAddress: string;
    postalCode: string;
    city?: string;
    placeId?: string | null;
    mapLat?: string | null;
    mapLng?: string | null;
  },
  tenantId?: string,
) {
  const existing = await getOrder(orderId, tenantId);
  if (!existing) return { ok: false as const, error: "Order not found." };

  const propertyAddress = input.propertyAddress.trim();
  const postalCode = input.postalCode.trim().toUpperCase();
  if (propertyAddress.length < 5) {
    return { ok: false as const, error: "Enter the full property address." };
  }
  if (postalCode.length < 3) {
    return { ok: false as const, error: "Enter a postal or ZIP code." };
  }

  const db = getDb();
  await qRun(
    db
      .update(schema.orders)
      .set({
        propertyAddress,
        postalCode,
        city: input.city?.trim() || null,
        placeId: input.placeId?.trim() || null,
        mapLat: input.mapLat?.trim() || null,
        mapLng: input.mapLng?.trim() || null,
        updatedAt: nowIso(),
      })
      .where(eq(schema.orders.id, orderId)),
  );

  await qRun(
    db
      .update(schema.galleries)
      .set({
        propertyAddress,
        updatedAt: nowIso(),
      })
      .where(eq(schema.galleries.orderId, orderId)),
  );

  return { ok: true as const, order: (await getOrder(orderId, tenantId))! };
}
