import { and, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { ReviewRequest, Testimonial } from "@/lib/db/schema";
import { reviewRequestEmail, sendEmail } from "@/lib/email";
import { getOrder } from "@/lib/orders";
import { publicStudioUrl } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const tokenId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);
const REVIEW_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

export async function ensureReviewRequest(orderId: string, tenantId: string) {
  const existing =
    (await qGet<ReviewRequest>(
      getDb()
        .select()
        .from(schema.reviewRequests)
        .where(
          and(
            eq(schema.reviewRequests.tenantId, tenantId),
            eq(schema.reviewRequests.orderId, orderId),
          ),
        ),
    )) ?? null;
  if (existing) return existing;

  const order = await getOrder(orderId, tenantId);
  if (!order) return null;
  const createdAt = nowIso();
  const row = {
    id: `rrq_${id()}`,
    tenantId,
    orderId,
    agentEmail: order.agentEmail,
    token: tokenId(),
    sentAt: null as string | null,
    createdAt,
  };
  await qRun(getDb().insert(schema.reviewRequests).values(row));
  return row;
}

export async function sendDueReviewRequests() {
  const db = getDb();
  const pending = await qAll<ReviewRequest>(db.select().from(schema.reviewRequests));
  let sent = 0;
  const cutoff = Date.now() - REVIEW_DELAY_MS;

  for (const request of pending) {
    if (request.sentAt) continue;
    if (new Date(request.createdAt).getTime() > cutoff) continue;
    const order = await getOrder(request.orderId, request.tenantId);
    if (!order || order.status !== "paid") continue;
    const tenant = await getTenant(request.tenantId);
    const row = await getTenantRow(request.tenantId);
    const siteUrl = publicStudioUrl({
      slug: tenant.slug,
      domain: row?.domain,
      siteUrl: tenant.siteUrl,
      domainStatus: row?.domainStatus,
    });
    const reviewUrl = `${siteUrl.replace(/\/$/, "")}/review/${request.token}`;
    await sendEmail(
      reviewRequestEmail({
        tenant,
        agentName: order.agentName,
        agentEmail: order.agentEmail,
        propertyAddress: order.propertyAddress,
        reviewUrl,
      }),
    );
    await qRun(
      db
        .update(schema.reviewRequests)
        .set({ sentAt: nowIso() })
        .where(eq(schema.reviewRequests.id, request.id)),
    );
    sent += 1;
  }
  return sent;
}

export async function getReviewRequestByToken(token: string) {
  const db = getDb();
  return (
    (await qGet<ReviewRequest>(
      db.select().from(schema.reviewRequests).where(eq(schema.reviewRequests.token, token)),
    )) ?? null
  );
}

export async function submitTestimonial(options: {
  request: ReviewRequest;
  body: string;
  rating: number;
  agentName: string;
}) {
  const db = getDb();
  await qRun(
    db.insert(schema.testimonials).values({
      id: `tst_${id()}`,
      tenantId: options.request.tenantId,
      orderId: options.request.orderId,
      agentName: options.agentName,
      agentEmail: options.request.agentEmail,
      body: options.body.trim(),
      rating: Math.min(5, Math.max(1, options.rating)),
      approvedAt: null,
      createdAt: nowIso(),
    }),
  );
}

export async function listTestimonials(tenantId: string, approvedOnly = false) {
  const db = getDb();
  const rows = await qAll<Testimonial>(
    db
      .select()
      .from(schema.testimonials)
      .where(eq(schema.testimonials.tenantId, tenantId))
      .orderBy(desc(schema.testimonials.createdAt)),
  );
  if (!approvedOnly) return rows;
  return rows.filter((row) => row.approvedAt);
}

export async function setTestimonialApproval(
  tenantId: string,
  testimonialId: string,
  approved: boolean,
) {
  const db = getDb();
  const row =
    (await qGet<Testimonial>(
      db.select().from(schema.testimonials).where(eq(schema.testimonials.id, testimonialId)),
    )) ?? null;
  if (!row || row.tenantId !== tenantId) return { ok: false as const, error: "Not found." };
  await qRun(
    db
      .update(schema.testimonials)
      .set({ approvedAt: approved ? nowIso() : null })
      .where(eq(schema.testimonials.id, testimonialId)),
  );
  return { ok: true as const };
}

export async function approvedTestimonialsForJsonLd(tenantId: string) {
  return listTestimonials(tenantId, true);
}
