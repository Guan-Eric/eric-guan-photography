"use client";

import { useEffect, useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

type CalendarState = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  calendarId: string | null;
  calendarName: string | null;
  blockExternalEvents: boolean;
  calendars: Array<{ id: string; summary: string; primary: boolean }>;
};

export function StudioCalendarSync() {
  const [state, setState] = useState<CalendarState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "settings" | null>(
    null,
  );

  async function load() {
    const response = await fetch("/api/admin/calendar");
    const json = await response.json();
    if (!json.ok) {
      setError(json.error ?? "Could not load calendar.");
      return;
    }
    setState(json);
    setError(null);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendar = params.get("calendar");
    const reason = params.get("reason");
    if (calendar === "connected") {
      toastSuccess("Google Calendar connected.");
    } else if (calendar === "error") {
      toastError(reason || "Could not connect Google Calendar.");
      setError(reason);
    }
    if (calendar) {
      params.delete("calendar");
      params.delete("reason");
      const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
    void load();
  }, []);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not start Google Calendar.");
        toastError(json.error ?? "Could not start Google Calendar.");
        return;
      }
      if (json.url) {
        window.location.href = json.url;
      }
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setError(null);
    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not disconnect.");
        toastError(json.error ?? "Could not disconnect.");
        return;
      }
      toastSuccess("Google Calendar disconnected.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(patch: {
    blockExternalEvents?: boolean;
    calendarId?: string;
  }) {
    setBusy("settings");
    setError(null);
    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settings", ...patch }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save calendar settings.");
        toastError(json.error ?? "Could not save calendar settings.");
        return;
      }
      setState(json);
      toastSuccess("Calendar settings saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="studio-section" data-tour="calendar">
      <h2>Google Calendar</h2>
      <p className="studio-section-lede">
        Requested times are held on Studiofront immediately so two agents cannot
        book the same window. Connect Google Calendar to copy those holds onto
        your personal calendar, and optionally block booking when you already
        have other events there.
      </p>

      {!state ? (
        <p className="muted">Loading calendar…</p>
      ) : !state.configured ? (
        <p className="field-hint">
          Calendar sync is not configured on this server yet. Add{" "}
          <code>GOOGLE_CALENDAR_CLIENT_ID</code> and{" "}
          <code>GOOGLE_CALENDAR_CLIENT_SECRET</code>, then reload.
        </p>
      ) : !state.connected ? (
        <button
          type="button"
          className={`btn btn-solid${busy === "connect" ? " is-busy" : ""}`}
          disabled={busy !== null}
          onClick={connect}
        >
          {busy === "connect" ? "Connecting…" : "Connect Google Calendar"}
        </button>
      ) : (
        <div className="calendar-sync-connected">
          <p className="muted">
            Connected as <strong>{state.accountEmail ?? "Google Calendar"}</strong>
          </p>
          <label className="field">
            <span>Calendar for Studiofront shoots</span>
            <select
              value={state.calendarId ?? "primary"}
              disabled={busy !== null}
              onChange={(event) => saveSettings({ calendarId: event.target.value })}
            >
              {(state.calendars.length
                ? state.calendars
                : [
                    {
                      id: state.calendarId ?? "primary",
                      summary: state.calendarName ?? "Primary",
                      primary: true,
                    },
                  ]
              ).map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.summary}
                  {calendar.primary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-check">
            <span>
              <input
                type="checkbox"
                checked={state.blockExternalEvents}
                disabled={busy !== null}
                onChange={(event) =>
                  saveSettings({ blockExternalEvents: event.target.checked })
                }
              />{" "}
              Block booking times when I have other calendar events
            </span>
          </label>
          <p className="field-hint">
            Off: only Studiofront requests and confirmed shoots hide slots. On:
            dentist appointments, personal holds, and anything else busy on the
            selected calendar also disappear from the booking page.
          </p>
          <button
            type="button"
            className={`btn btn-outline${busy === "disconnect" ? " is-busy" : ""}`}
            disabled={busy !== null}
            onClick={disconnect}
          >
            {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
