"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Testimonial } from "@/lib/db/schema";

export function ReviewsAdmin({ items }: { items: Testimonial[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setApproved(id: string, approved: boolean) {
    setBusy(id);
    await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="studio-settings">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Social proof</p>
          <h1>Reviews</h1>
          <p className="muted">
            Approved reviews appear on your public site and listing pages.
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="studio-empty">
          <h2>No reviews yet</h2>
          <p>Agents get a review link a few days after they pay.</p>
        </div>
      ) : (
        <ul className="listing-index">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {item.agentName} · {item.rating}/5
                </strong>
                <span className="muted">{item.body}</span>
              </div>
              <div className="listing-index-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy !== null}
                  onClick={() => setApproved(item.id, !item.approvedAt)}
                >
                  {item.approvedAt ? "Hide" : "Approve"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
