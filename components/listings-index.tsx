"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ListingPage } from "@/lib/db/schema";
import {
  listingStateLabel,
  type ListingPublicState,
} from "@/lib/listing-compliance";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "waiting_on_agent", label: "Waiting on agent" },
  { id: "draft", label: "Draft" },
  { id: "sold", label: "Sold" },
  { id: "ended", label: "Ended" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

export type ListingIndexRow = {
  page: ListingPage;
  state: ListingPublicState;
  checklistErrors: string[];
};

export function ListingsIndex({
  rows,
  siteUrl,
}: {
  rows: ListingIndexRow[];
  siteUrl: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.state !== status) return false;
      if (!needle) return true;
      const haystack = `${row.page.title} ${row.page.propertyAddress} ${row.page.slug}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, rows, status]);

  const visible = filtered.slice(0, limit);

  return (
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
            placeholder="Address or title"
          />
        </label>
        <div className="admin-filter-chips" role="group" aria-label="Listing status">
          {STATUS_FILTERS.map((chip) => {
            const count =
              chip.id === "all"
                ? rows.length
                : rows.filter((row) => row.state === chip.id).length;
            return (
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
                {chip.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="studio-empty">
          <h2>No matching listings</h2>
          <p>Try another search or status filter.</p>
        </div>
      ) : (
        <>
          <ul className="listing-index">
            {visible.map(({ page, state, checklistErrors }) => {
              const viewHref =
                state === "live"
                  ? `${siteUrl.replace(/\/$/, "")}/p/${page.slug}`
                  : `/admin/listings/${page.id}/preview`;
              return (
                <li key={page.id}>
                  <div>
                    <strong>{page.title}</strong>
                    <span className="muted">
                      {page.propertyAddress} ·{" "}
                      <span className={`listing-state-badge is-${state}`}>
                        {listingStateLabel(state)}
                      </span>
                      {checklistErrors[0] ? ` · ${checklistErrors[0]}` : null}
                    </span>
                  </div>
                  <div className="listing-index-actions">
                    <Link className="btn btn-outline" href={`/admin/listings/${page.id}`}>
                      Edit
                    </Link>
                    <a
                      className="text-link"
                      href={viewHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {state === "live" ? "View" : "Preview"}
                    </a>
                  </div>
                </li>
              );
            })}
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
  );
}
