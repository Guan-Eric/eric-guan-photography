"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Appointment, Order } from "@/lib/db/schema";
import { toastError, toastSuccess } from "@/lib/toast";

type Milestone = "onMyWayAt" | "arrivedAt" | "completedAt";

function nextMilestone(appointment: Appointment): Milestone | null {
  if (!appointment.onMyWayAt) return "onMyWayAt";
  if (!appointment.arrivedAt) return "arrivedAt";
  if (!appointment.completedAt) return "completedAt";
  return null;
}

export function ShootDayBoard({
  timezone,
  items,
}: {
  timezone: string;
  items: Array<{
    appointment: Appointment;
    order: Order | null;
    shotList: string[];
  }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function mark(appointmentId: string, milestone: Milestone) {
    setBusy(appointmentId);
    try {
      const response = await fetch("/api/admin/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, milestone }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        toastError(json?.error ?? "Could not update that shoot.");
        return;
      }
      const labels = {
        onMyWayAt: "On-my-way sent to the agent.",
        arrivedAt: "Arrived notice sent.",
        completedAt: "Shoot marked complete.",
      };
      toastSuccess(labels[milestone]);
      router.refresh();
    } catch {
      toastError("Network error updating shoot day.");
    } finally {
      setBusy(null);
    }
  }

  function timeLabel(iso: string) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  return (
    <div className="studio-settings">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Shoot day</p>
          <h1>Today</h1>
          <p className="muted">On-my-way and arrived emails go to the agent.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="studio-empty">
          <h2>No shoots today</h2>
          <p>Confirmed appointments for today show up here.</p>
        </div>
      ) : (
        <ul className="shoot-day-list">
          {items.map(({ appointment, order, shotList }) => {
            if (!order) return null;
            const next = nextMilestone(appointment);
            const busyThis = busy === appointment.id;
            const labels: Record<Milestone, { idle: string; busy: string }> = {
              onMyWayAt: { idle: "On my way", busy: "Sending…" },
              arrivedAt: { idle: "I've arrived", busy: "Sending…" },
              completedAt: { idle: "Complete", busy: "Saving…" },
            };
            return (
              <li key={appointment.id}>
                <div className="shoot-day-copy">
                  <strong>
                    {timeLabel(appointment.startsAt)} · {order.propertyAddress}
                  </strong>
                  <span className="muted">
                    {order.agentName} · {order.packageName}
                  </span>
                  {shotList.length > 0 ? (
                    <ul className="pill-list">
                      {shotList.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="shoot-day-actions">
                  <button
                    type="button"
                    className={`btn ${next === "completedAt" || !next ? "btn-solid" : "btn-outline"}${busyThis ? " is-busy" : ""}`}
                    disabled={next === null || busy !== null}
                    onClick={() => next && mark(appointment.id, next)}
                  >
                    {busyThis && next
                      ? labels[next].busy
                      : next
                        ? labels[next].idle
                        : "Done"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
