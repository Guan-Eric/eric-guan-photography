"use client";

import type { UploadQueueItem } from "@/lib/upload-queue";
import { queueTrayStats } from "@/lib/upload-queue";

export function UploadTray({
  items,
  onRetryFailed,
  onCancelAll,
  onDismiss,
}: {
  items: UploadQueueItem[];
  onRetryFailed?: () => void;
  onCancelAll?: () => void;
  onDismiss?: () => void;
}) {
  const stats = queueTrayStats(items);
  if (stats.total === 0) return null;

  const active =
    stats.activeCount > 0 ||
    (stats.failedCount > 0 && stats.doneCount + stats.failedCount < stats.total);
  const show =
    stats.activeCount > 0 ||
    stats.failedCount > 0 ||
    (stats.doneCount > 0 && stats.completed === stats.total);

  if (!show) return null;

  return (
    <div
      className={`upload-tray${stats.failedCount > 0 && stats.activeCount === 0 ? " is-failed" : ""}${stats.activeCount === 0 && stats.failedCount === 0 ? " is-done" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="upload-tray-copy">
        <strong>{stats.label || "Uploads"}</strong>
        {stats.activeCount > 0 ? (
          <span className="muted">
            {stats.uploading} in flight · {stats.activeCount - stats.uploading}{" "}
            queued
          </span>
        ) : stats.failedCount > 0 ? (
          <span className="muted">
            {stats.failedCount} failed
            {stats.doneCount > 0 ? ` · ${stats.doneCount} done` : ""}
          </span>
        ) : (
          <span className="muted">All set</span>
        )}
      </div>
      <div className="upload-tray-actions">
        {stats.failedCount > 0 && onRetryFailed ? (
          <button type="button" className="btn btn-outline" onClick={onRetryFailed}>
            Retry failed
          </button>
        ) : null}
        {stats.activeCount > 0 && onCancelAll ? (
          <button type="button" className="btn btn-outline" onClick={onCancelAll}>
            Cancel
          </button>
        ) : null}
        {!active && onDismiss ? (
          <button type="button" className="btn btn-outline" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
