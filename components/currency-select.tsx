"use client";

import { useMemo } from "react";
import {
  listStudioCurrencies,
  normalizeStudioCurrency,
  studioCurrencyLabel,
} from "@/lib/currency";

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
  const current = normalizeStudioCurrency(value);
  const options = useMemo(() => {
    const listed = listStudioCurrencies();
    if (listed.some((item) => item.code === current)) return listed;
    return [{ code: current, label: studioCurrencyLabel(current) }, ...listed];
  }, [current]);

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
