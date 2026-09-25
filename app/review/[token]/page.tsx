import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";
import { ReviewForm } from "@/components/review-form";
import { getOrder } from "@/lib/orders";
import { getReviewRequestByToken } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Leave a review",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await getReviewRequestByToken(token);
  if (!request) {
    return (
      <StatusPage
        eyebrow="Review"
        title="This review link is invalid or has expired"
        body="Ask your photographer for a fresh review link if you’d still like to leave feedback."
      />
    );
  }
  const order = await getOrder(request.orderId, request.tenantId);
  return (
    <main className="page-section" id="main">
      <div className="page-inner">
        <ReviewForm
          token={token}
          propertyAddress={order?.propertyAddress ?? "your listing"}
        />
      </div>
    </main>
  );
}
