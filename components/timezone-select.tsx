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
  const zones = useMemo(() => listTimeZones(), []);
  const current = normalizeTimeZone(value);

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
