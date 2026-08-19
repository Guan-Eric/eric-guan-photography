"use client";

import { useEffect, useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

type DomainState = {
  hostname: string;
  status: string;
  expectedTarget: string;
  note: string;
};

export function ListingDomainEditor({ pageId }: { pageId: string }) {
  const [hostname, setHostname] = useState("");
  const [state, setState] = useState<DomainState | null>(null);
  const [disabledNote, setDisabledNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "clear" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch(`/api/admin/listings/${pageId}/domain`);
    const json = await response.json().catch(() => null);
    if (json?.disabled) {
      setDisabledNote(json.note ?? "Custom domains are temporarily unavailable.");
      return;
    }
    if (json?.domain) {
      setHostname(json.domain.hostname ?? "");
      setState({
        hostname: json.domain.hostname,
        status: json.domain.status,
        expectedTarget: json.expectedTarget ?? "",
        note: json.note ?? "",
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  async function save(action: "save" | "clear" | "refresh") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/listings/${pageId}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname, action }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        const message = json?.error ?? "Could not save the domain.";
        setError(message);
        toastError(message);
        return;
      }
      await load();
      toastSuccess(
        action === "clear"
          ? "Listing domain removed."
          : action === "refresh"
            ? "Domain status updated."
            : "Listing domain saved.",
      );
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="studio-section">
      <h2>Listing domain</h2>
      {disabledNote ? (
        <p className="field-hint">{disabledNote}</p>
      ) : (
        <>
          <p className="muted">
            Point a CNAME at the platform target, then save. Agents can pay for a
            year of this hostname from the listing page. You are billed $5/mo per
            live custom hostname.
          </p>
          <label className="field">
            <span>Hostname</span>
            <input
              value={hostname}
              placeholder="123main.yourbrand.com"
              onChange={(event) => setHostname(event.target.value)}
            />
          </label>
          {state ? (
            <p className="field-hint">
              Status: {state.status}
              {state.expectedTarget ? ` · CNAME → ${state.expectedTarget}` : ""}
              {state.note ? ` · ${state.note}` : ""}
            </p>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <div className="listing-index-actions">
            <button
              type="button"
              className={`btn btn-solid${busy === "save" ? " is-busy" : ""}`}
              disabled={busy !== null}
              onClick={() => save("save")}
            >
              {busy === "save" ? "Saving…" : "Save domain"}
            </button>
            <button
              type="button"
              className={`btn btn-outline${busy === "refresh" ? " is-busy" : ""}`}
              disabled={busy !== null}
              onClick={() => save("refresh")}
            >
              {busy === "refresh" ? "Checking…" : "Check status"}
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy !== null}
              onClick={() => save("clear")}
            >
              {busy === "clear" ? "Removing…" : "Remove"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
