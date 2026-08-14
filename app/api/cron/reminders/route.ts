import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dayBeforeReminderEmail, sendEmail } from "@/lib/email";
import { getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const db = getDb();
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;
  const in36h = now + 36 * 60 * 60 * 1000;

  const appointments = db.select().from(schema.appointments).all();
  let sent = 0;

  for (const appointment of appointments) {
    const start = new Date(appointment.startsAt).getTime();
    if (start < in24h || start > in36h) continue;

    const already = db
      .select()
      .from(schema.reminderSends)
      .where(
        and(
          eq(schema.reminderSends.orderId, appointment.orderId),
          eq(schema.reminderSends.kind, "day_before"),
        ),
      )
      .get();
    if (already) continue;

    const order = getOrder(appointment.orderId, appointment.tenantId);
    if (!order || order.status === "cancelled") continue;

    const tenant = getTenant(order.tenantId);
    await sendEmail(
      dayBeforeReminderEmail({
        tenant,
        order,
        prepUrl: `${tenant.siteUrl}/prep`,
      }),
    );

    db.insert(schema.reminderSends)
      .values({
        id: `rem_${appointment.orderId}_day`,
        tenantId: order.tenantId,
        orderId: order.id,
        kind: "day_before",
        sentAt: new Date().toISOString(),
      })
      .run();
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
