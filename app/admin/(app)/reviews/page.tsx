import type { Metadata } from "next";
import { ReviewsAdmin } from "@/components/reviews-admin";
import { getPhotographerSession } from "@/lib/auth";
import { listTestimonials } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage() {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;
  const items = await listTestimonials(session.activeTenantId, false);
  return <ReviewsAdmin items={items} />;
}
