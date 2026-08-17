import { NextResponse } from "next/server";
import { requireTenantMembership } from "@/lib/auth";
import { statusUpdateSchema } from "@/lib/booking-schema";
import { getDb, qGet, schema } from "@/lib/db";
import type { Appointment } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  notifyOrderPriceChange,
  notifyOrderStatusChange,
} from "@/lib/order-notify";
import {
  getOrder,
  updateOrderAddress,
  updateOrderPrice,
  updateOrderStatus,
} from "@/lib/orders";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

type Params = { id: string };

function formatScheduleLabel(startsAt: string, endsAt: string, timezone: string) {
  try {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(start);
    const time = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    });
    return `${day}, ${time.format(start)} – ${time.format(end)}`;
  } catch {
    return `${startsAt} – ${endsAt}`;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const auth = await requireTenantMembership(order.tenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Invalid update. Delivered and Paid are set by Publish / Unlock, not the status menu.",
      },
      { status: 400 },
    );
  }

  let current = order;
  const previousPriceCents = order.priceCents;

  if (parsed.data.propertyAddress != null) {
    const addressed = await updateOrderAddress(
      id,
      {
        propertyAddress: parsed.data.propertyAddress,
        postalCode: parsed.data.postalCode ?? order.postalCode,
        city: parsed.data.city ?? order.city ?? undefined,
        placeId:
          parsed.data.placeId !== undefined ? parsed.data.placeId : order.placeId,
        mapLat:
          parsed.data.mapLat !== undefined ? parsed.data.mapLat : order.mapLat,
        mapLng:
          parsed.data.mapLng !== undefined ? parsed.data.mapLng : order.mapLng,
      },
      order.tenantId,
    );
    if (!addressed.ok) {
      return NextResponse.json(addressed, { status: 400 });
    }
    current = addressed.order;
  }

  if (parsed.data.priceCents != null) {
    const priced = await updateOrderPrice(
      id,
      parsed.data.priceCents,
      order.tenantId,
    );
    if (!priced.ok) {
      return NextResponse.json(priced, { status: 404 });
    }
    current = priced.order;
    if (priced.order.priceCents !== previousPriceCents) {
      const tenant = await getTenant(order.tenantId);
      await notifyOrderPriceChange({
        tenant,
        order: priced.order,
        previousPriceCents,
      });
    }
  }

  if (parsed.data.status == null) {
    return NextResponse.json({ ok: true as const, order: current });
  }

  const result = await updateOrderStatus(id, parsed.data.status, order.tenantId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }

  let scheduledLabel: string | undefined;
  if (parsed.data.status === "confirmed") {
    const db = getDb();
    const appointment = await qGet<Appointment>(
      db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.orderId, id)),
    );
    if (appointment) {
      const row = await getTenantRow(order.tenantId);
      scheduledLabel = formatScheduleLabel(
        appointment.startsAt,
        appointment.endsAt,
        row?.timezone ?? "America/Toronto",
      );
    }
  }

  await notifyOrderStatusChange({
    tenantId: order.tenantId,
    order: result.order,
    status: parsed.data.status,
    scheduledLabel,
  });

  return NextResponse.json(result);
}
