import { NextResponse } from "next/server";
import { z } from "zod";
import { getPhotographerSession, requireTenantMembership } from "@/lib/auth";
import {
  photographerArrivedEmail,
  photographerOnMyWayEmail,
  sendEmail,
} from "@/lib/email";
import { getOrder, markAppointmentMilestone } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const bodySchema = z.object({
  appointmentId: z.string().min(1),
  milestone: z.enum(["onMyWayAt", "arrivedAt", "completedAt"]),
});

export async function POST(request: Request) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const auth = await requireTenantMembership(session.activeTenantId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Missing appointment." }, { status: 400 });
  }

  const result = await markAppointmentMilestone(
    session.activeTenantId,
    parsed.data.appointmentId,
    parsed.data.milestone,
  );
  if (!result.ok) return NextResponse.json(result, { status: 404 });

  const order = await getOrder(result.appointment.orderId, session.activeTenantId);
  const tenant = await getTenant(session.activeTenantId);
  if (order && parsed.data.milestone === "onMyWayAt") {
    await sendEmail(
      photographerOnMyWayEmail({
        tenant,
        order,
        agentEmail: order.agentEmail,
        agentName: order.agentName,
      }),
    );
  }
  if (order && parsed.data.milestone === "arrivedAt") {
    await sendEmail(
      photographerArrivedEmail({
        tenant,
        order,
        agentEmail: order.agentEmail,
        agentName: order.agentName,
      }),
    );
  }

  return NextResponse.json(result);
}
