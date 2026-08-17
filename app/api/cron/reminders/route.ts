import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import {
  dayBeforeReminderEmail,
  photographerDayBeforeReminderEmail,
  sendEmail,
} from "@/lib/email";
import { sendDueReviewRequests } from "@/lib/reviews";
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

  const appointments = await qAll<{
    startsAt: string;
    orderId: string;
    tenantId: string;
  }>(db.select().from(schema.appointments));
  let sent = 0;

  for (const appointment of appointments) {
    const start = new Date(appointment.startsAt).getTime();
    if (start < in24h || start > in36h) continue;

    const already = await qGet(
      db
        .select()
        .from(schema.reminderSends)
        .where(
          and(
            eq(schema.reminderSends.orderId, appointment.orderId),
            eq(schema.reminderSends.kind, "day_before"),
          ),
        ),
    );
    if (already) continue;

    const order = await getOrder(appointment.orderId, appointment.tenantId);
    if (!order || order.status === "cancelled") continue;

    const tenant = await getTenant(order.tenantId);
    const prepUrl = `${tenant.siteUrl.replace(/\/$/, "")}/prep`;
    const adminUrl = `${tenant.siteUrl.replace(/\/$/, "")}/admin`;

    await sendEmail(
      dayBeforeReminderEmail({
        tenant,
        order,
        prepUrl,
      }),
    );
    await sendEmail(
      photographerDayBeforeReminderEmail({
        tenant,
        order,
        adminUrl,
      }),
    );

    await qRun(
      db.insert(schema.reminderSends).values({
        id: `rem_${appointment.orderId}_day`,
        tenantId: order.tenantId,
        orderId: order.id,
        kind: "day_before",
        sentAt: new Date().toISOString(),
      }),
    );
    sent += 1;
  }

  const reviews = await sendDueReviewRequests();
  return NextResponse.json({ ok: true, sent, reviews });
}
