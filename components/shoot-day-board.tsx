"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Appointment, Order } from "@/lib/db/schema";

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

  async function mark(appointmentId: string, milestone: "onMyWayAt" | "arrivedAt" | "completedAt") {
    setBusy(appointmentId + milestone);
    await fetch("/api/admin/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, milestone }),
    });
    setBusy(null);
    router.refresh();
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
        <ul className="listing-index">
          {items.map(({ appointment, order, shotList }) =>
            order ? (
              <li key={appointment.id}>
                <div>
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
                <div className="listing-index-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={Boolean(appointment.onMyWayAt) || busy !== null}
                    onClick={() => mark(appointment.id, "onMyWayAt")}
                  >
                    {appointment.onMyWayAt ? "On the way" : "On my way"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={Boolean(appointment.arrivedAt) || busy !== null}
                    onClick={() => mark(appointment.id, "arrivedAt")}
                  >
                    {appointment.arrivedAt ? "Arrived" : "I've arrived"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-solid"
                    disabled={Boolean(appointment.completedAt) || busy !== null}
                    onClick={() => mark(appointment.id, "completedAt")}
                  >
                    {appointment.completedAt ? "Done" : "Complete"}
                  </button>
                </div>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}
