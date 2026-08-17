"use client";

import Link from "next/link";
import { useState } from "react";
import { TimezoneSelect } from "@/components/timezone-select";
import type { Order } from "@/lib/db/schema";
import { parsePreferredSlotsJson } from "@/lib/preferred-slots";
import { resolveSchedule, scheduleTimeOptions, weekdayLabel } from "@/lib/schedule";
import type { DaySchedule, WeekdayKey, WeeklySchedule } from "@/lib/tenant-schema";
import { WEEKDAY_KEYS } from "@/lib/tenant-schema";
import { normalizeTimeZone } from "@/lib/timezones";

function formatWhen(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function StudioScheduleEditor({
  initialSchedule,
  timezone: initialTimezone,
  bookings,
}: {
  initialSchedule?: WeeklySchedule | null;
  timezone: string;
  bookings: Order[];
}) {
  const [schedule, setSchedule] = useState(() => resolveSchedule(initialSchedule));
  const [timezone, setTimezone] = useState(() => normalizeTimeZone(initialTimezone));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function patchDay(key: WeekdayKey, patch: Partial<DaySchedule>) {
    setSchedule((current) => ({
      ...current,
      days: {
        ...current.days,
        [key]: { ...current.days[key], ...patch },
      },
    }));
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "schedule",
          timezone,
          schedule,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save.");
        return;
      }
      setMessage("Schedule saved. Booking slots update immediately.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-settings studio-settings--wide">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>Availability & bookings</h1>
        </div>
        <Link className="btn btn-outline" href="/admin">
          All orders
        </Link>
      </div>

      <form className="studio-schedule-form" onSubmit={onSave}>
        <section className="studio-section">
          <h2>Weekly hours</h2>
          <p className="studio-section-lede">
            Agents only see start times that finish by close, with travel buffer between
            confirmed shoots.
          </p>
          <div className="schedule-day-list">
            {WEEKDAY_KEYS.map((key) => {
              const day = schedule.days[key];
              return (
                <div className="schedule-day-row" key={key}>
                  <label className="field field-check schedule-day-toggle">
                    <span>
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(event) =>
                          patchDay(key, { enabled: event.target.checked })
                        }
                      />{" "}
                      {weekdayLabel(key)}
                    </span>
                  </label>
                  <label className="field">
                    <span className="sr-only">Open</span>
                    <select
                      value={day.open}
                      disabled={!day.enabled}
                      onChange={(event) => patchDay(key, { open: event.target.value })}
                    >
                      {scheduleTimeOptions(day.open).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="schedule-day-sep" aria-hidden>
                    to
                  </span>
                  <label className="field">
                    <span className="sr-only">Close</span>
                    <select
                      value={day.close}
                      disabled={!day.enabled}
                      onChange={(event) => patchDay(key, { close: event.target.value })}
                    >
                      {scheduleTimeOptions(day.close).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <section className="studio-section">
          <h2>Booking window</h2>
          <div className="form-grid">
            <label className="field">
              <span>Timezone</span>
              <TimezoneSelect value={timezone} onChange={setTimezone} required />
            </label>
            <label className="field">
              <span>Slot interval</span>
              <select
                value={schedule.slotIntervalMinutes}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    slotIntervalMinutes: Number(event.target.value),
                  }))
                }
              >
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
              </select>
            </label>
            <label className="field">
              <span>Lead time (hours)</span>
              <input
                type="number"
                min={0}
                max={72}
                value={schedule.leadTimeHours}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    leadTimeHours: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Offer days ahead</span>
              <input
                type="number"
                min={1}
                max={60}
                value={schedule.offerDays}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    offerDays: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
        </section>

        {message ? <p className="form-success">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn btn-solid" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save schedule"}
        </button>
      </form>

      <section className="studio-section">
        <h2>Incoming bookings</h2>
        <p className="studio-section-lede">
          Requested and confirmed shoots. Confirm on the Orders board to hold the primary
          slot on your calendar.
        </p>
        {bookings.length === 0 ? (
          <p className="studio-empty-inline">No open bookings yet.</p>
        ) : (
          <ul className="schedule-booking-list">
            {bookings.map((order) => {
              const slots = parsePreferredSlotsJson(order.preferredSlotsJson);
              return (
                <li className="schedule-booking-card" key={order.id}>
                  <div className="schedule-booking-head">
                    <div>
                      <p className="schedule-booking-status">{order.status}</p>
                      <h3>{order.propertyAddress}</h3>
                      <p>
                        {order.agentName}
                        {order.brokerage ? ` · ${order.brokerage}` : ""}
                      </p>
                    </div>
                    <p className="schedule-booking-pkg">{order.packageName}</p>
                  </div>
                  <ul className="schedule-slot-prefs">
                    {(slots.length > 0
                      ? slots
                      : [
                          {
                            start: order.preferredStart,
                            end: order.preferredEnd,
                            label: formatWhen(order.preferredStart, timezone),
                          },
                        ]
                    ).map((slot, index) => (
                      <li key={`${order.id}-${slot.start}-${index}`}>
                        {index === 0 ? "Primary: " : `Alt ${index}: `}
                        {slot.label || formatWhen(slot.start, timezone)}
                      </li>
                    ))}
                  </ul>
                  <p className="schedule-booking-meta">
                    {order.postalCode}
                    {order.city ? ` · ${order.city}` : ""} ·{" "}
                    <a href={`mailto:${order.agentEmail}`}>{order.agentEmail}</a>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
