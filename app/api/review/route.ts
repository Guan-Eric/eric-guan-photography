import { NextResponse } from "next/server";
import { z } from "zod";
import { getReviewRequestByToken, submitTestimonial } from "@/lib/reviews";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(8),
  body: z.string().trim().min(8).max(2000),
  rating: z.coerce.number().int().min(1).max(5),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Write a short review and pick a rating." },
      { status: 400 },
    );
  }
  const requestRow = await getReviewRequestByToken(parsed.data.token);
  if (!requestRow) {
    return NextResponse.json({ ok: false, error: "This review link expired." }, { status: 404 });
  }
  const order = await getOrder(requestRow.orderId, requestRow.tenantId);
  await submitTestimonial({
    request: requestRow,
    body: parsed.data.body,
    rating: parsed.data.rating,
    agentName: order?.agentName ?? "Agent",
  });
  return NextResponse.json({ ok: true });
}
