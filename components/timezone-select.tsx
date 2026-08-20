"use client";

import { useMemo } from "react";
import { listTimeZones, normalizeTimeZone, timeZoneLabel } from "@/lib/timezones";

export function TimezoneSelect({
  value,
  onChange,
  id,
  name = "timezone",
  required,
}: {
  value: string;
  onChange: (zone: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
}) {
  const current = normalizeTimeZone(value);
  const zones = useMemo(() => {
    const listed = listTimeZones();
    return listed.includes(current) ? listed : [current, ...listed];
  }, [current]);

  return (
    <select
      id={id}
      name={name}
      value={current}
      required={required}
      onChange={(event) => onChange(event.target.value)}
    >
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {timeZoneLabel(zone)}
        </option>
      ))}
    </select>
  );
}
