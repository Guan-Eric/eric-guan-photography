"use client";

import { useMemo } from "react";
import { listStudioCurrencies, normalizeStudioCurrency } from "@/lib/currency";

export function CurrencySelect({
  value,
  onChange,
  id,
  name = "currency",
  required,
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
}) {
  const options = useMemo(() => listStudioCurrencies(), []);
  const current = normalizeStudioCurrency(value);

  return (
    <select
      id={id}
      name={name}
      value={current}
      required={required}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((item) => (
        <option key={item.code} value={item.code}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
