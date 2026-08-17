"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  newPlacesSessionToken,
  type PlaceSuggestion,
  type ResolvedAddress,
} from "@/lib/places";

export function AddressAutocomplete({
  value,
  onChange,
  onResolved,
  invalid,
  describedBy,
  required,
  placeholder = "Start typing the street address",
}: {
  value: string;
  onChange: (value: string) => void;
  onResolved: (address: ResolvedAddress) => void;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [sessionToken, setSessionToken] = useState(newPlacesSessionToken);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function schedule(query: string) {
    if (timer.current) clearTimeout(timer.current);
    setHint(null);
    if (disabled || query.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => void lookup(query), 250);
  }

  async function lookup(query: string) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/geo/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sessionToken }),
        signal: controller.signal,
      });
      const json = await response.json().catch(() => null);
      if (json?.disabled) {
        setDisabled(true);
        setSuggestions([]);
        setOpen(false);
        setHint("Address lookup is offline — type the full address manually.");
        return;
      }
      if (!json?.ok) {
        setSuggestions([]);
        setOpen(false);
        if (response.status >= 500) {
          setHint("Address lookup failed. Try again or type manually.");
        }
        return;
      }
      const next = (json.suggestions ?? []) as PlaceSuggestion[];
      setSuggestions(next);
      setActive(0);
      setOpen(next.length > 0);
      if (next.length === 0 && query.trim().length >= 5) {
        setHint("No matches — keep typing or enter the address manually.");
      }
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      setSuggestions([]);
      setOpen(false);
    }
  }

  async function pick(suggestion: PlaceSuggestion) {
    setOpen(false);
    setHint(null);
    onChange(suggestion.primary);
    const response = await fetch("/api/geo/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: suggestion.placeId, sessionToken }),
    });
    const json = await response.json().catch(() => null);
    setSessionToken(newPlacesSessionToken());
    if (!json?.ok || !json.address) {
      setHint("Could not fill city and postal — enter them manually.");
      return;
    }
    onResolved(json.address as ResolvedAddress);
  }

  return (
    <div className="address-suggest">
      <input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && suggestions[active] ? `${listId}-${active}` : undefined
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        required={required}
        onChange={(event) => {
          onChange(event.target.value);
          schedule(event.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(suggestions.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter" && suggestions[active]) {
            event.preventDefault();
            void pick(suggestions[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open ? (
        <ul id={listId} className="address-suggest-list" role="listbox">
          {suggestions.map((item, index) => (
            <li
              key={item.placeId}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? "is-active" : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                void pick(item);
              }}
            >
              <strong>{item.primary}</strong>
              {item.secondary ? <span>{item.secondary}</span> : null}
            </li>
          ))}
          <li className="address-suggest-mark" aria-hidden="true">
            Powered by Google
          </li>
        </ul>
      ) : null}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
