"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Testimonial } from "@/lib/db/schema";
import { toastError, toastSuccess } from "@/lib/toast";

const PAGE_SIZE = 25;

type StatusFilter = "pending" | "approved" | "all";

export function ReviewsAdmin({ items }: { items: Testimonial[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const pendingCount = items.filter((item) => !item.approvedAt).length;
  const approvedCount = items.filter((item) => Boolean(item.approvedAt)).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status === "pending" && item.approvedAt) return false;
      if (status === "approved" && !item.approvedAt) return false;
      if (!needle) return true;
      const haystack = `${item.agentName} ${item.body}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, status]);

  const visible = filtered.slice(0, limit);

  async function setApproved(id: string, approved: boolean) {
    setBusy(id);
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        toastError(json?.error ?? "Could not update that review.");
        return;
      }
      toastSuccess(approved ? "Review approved." : "Review hidden.");
      router.refresh();
    } catch {
      toastError("Network error updating review.");
    } finally {
      setBusy(null);
    }
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
        <>
          <div className="admin-filter-bar">
            <label className="field">
              <span>Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(PAGE_SIZE);
                }}
                placeholder="Agent or review text"
              />
            </label>
            <div className="admin-filter-chips" role="group" aria-label="Review status">
              {(
                [
                  { id: "pending", label: "Pending", count: pendingCount },
                  { id: "approved", label: "Approved", count: approvedCount },
                  { id: "all", label: "All", count: items.length },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`admin-filter-chip${status === chip.id ? " is-active" : ""}`}
                  aria-pressed={status === chip.id}
                  onClick={() => {
                    setStatus(chip.id);
                    setLimit(PAGE_SIZE);
                  }}
                >
                  {chip.label} ({chip.count})
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="studio-empty">
              <h2>No matching reviews</h2>
              <p>Try another search or status filter.</p>
            </div>
          ) : (
            <>
              <ul className="listing-index">
                {visible.map((item) => (
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
                        className={`btn btn-outline${busy === item.id ? " is-busy" : ""}`}
                        disabled={busy !== null}
                        onClick={() => setApproved(item.id, !item.approvedAt)}
                      >
                        {busy === item.id
                          ? "Saving…"
                          : item.approvedAt
                            ? "Hide"
                            : "Approve"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {filtered.length > limit ? (
                <div className="admin-show-more">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setLimit((current) => current + PAGE_SIZE)}
                  >
                    Show more ({filtered.length - limit} remaining)
                  </button>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
