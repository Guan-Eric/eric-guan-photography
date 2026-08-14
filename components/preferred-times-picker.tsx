"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  dayChipLabel,
  groupSlotsByDay,
  timeOnlyLabel,
  type PreferredSlot,
} from "@/lib/preferred-slots";

type Slot = { start: string; end: string; label: string };

const MAX_PREFERRED = 3;

const RANK_LABELS = ["1st choice", "2nd choice", "3rd choice"] as const;

type Props = {
  slots: Slot[];
  selectedSlots: PreferredSlot[];
  onChange: (next: PreferredSlot[]) => void;
  email: string;
  onError: (message: string | null) => void;
  invalid?: boolean;
  errorMessage?: string;
};

export function PreferredTimesPicker({
  slots,
  selectedSlots,
  onChange,
  email,
  onError,
  invalid = false,
  errorMessage,
}: Props) {
  const days = useMemo(() => groupSlotsByDay(slots), [slots]);
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const activeDay = days.find((day) => day.key === selectedDayKey) ?? days[0];
  const timesForDay = activeDay?.slots ?? [];

  useEffect(() => {
    if (!days.length) {
      setSelectedDayKey("");
      return;
    }
    if (!days.some((day) => day.key === selectedDayKey)) {
      setSelectedDayKey(days[0].key);
    }
  }, [days, selectedDayKey]);

  function toggleSlot(slot: PreferredSlot) {
    const exists = selectedSlots.some((selected) => selected.start === slot.start);
    if (exists) {
      onError(null);
      onChange(selectedSlots.filter((selected) => selected.start !== slot.start));
      return;
    }
    if (selectedSlots.length >= MAX_PREFERRED) {
      onError(`You can save up to ${MAX_PREFERRED} preferred times. Remove one first.`);
      return;
    }
    onError(null);
    onChange([...selectedSlots, slot]);
  }

  function removeSlot(start: string) {
    onError(null);
    onChange(selectedSlots.filter((slot) => slot.start !== start));
  }

  function moveSlot(from: number, to: number) {
    if (to < 0 || to >= selectedSlots.length || from === to) return;
    const next = [...selectedSlots];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  if (slots.length === 0) {
    return (
      <p className="form-error">
        No open slots for this package size in the next two weeks. Email{" "}
        <a href={`mailto:${email}`}>{email}</a>.
      </p>
    );
  }

  return (
    <div className={`preferred-picker${invalid ? " is-invalid" : ""}`}>
      <p className="field-hint">
        Tap a day, then tap times to add (up to {MAX_PREFERRED}). Drag your choices
        to set 1st / 2nd / 3rd. Times are America/Toronto.
      </p>
      {errorMessage ? (
        <p className="field-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="day-chip-row" role="listbox" aria-label="Available days">
        {days.map((day) => {
          const isActive = (activeDay?.key ?? "") === day.key;
          return (
            <button
              key={day.key}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`day-chip${isActive ? " is-selected" : ""}`}
              onClick={() => setSelectedDayKey(day.key)}
            >
              <span className="day-chip-date">
                {dayChipLabel(day.slots[0].start)}
              </span>
              <span className="day-chip-count">{day.slots.length} open</span>
            </button>
          );
        })}
      </div>

      <p className="preferred-day-heading">{activeDay?.label}</p>
      <div className="time-chip-row" role="group" aria-label={`Times on ${activeDay?.label}`}>
        {timesForDay.map((slot) => {
          const selected = selectedSlots.some((item) => item.start === slot.start);
          return (
            <button
              key={slot.start}
              type="button"
              className={`time-chip${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => toggleSlot(slot)}
            >
              {timeOnlyLabel(slot.start)}
            </button>
          );
        })}
      </div>

      {selectedSlots.length > 0 ? (
        <ul className="preferred-list">
          {selectedSlots.map((slot, index) => (
            <li
              key={slot.start}
              className={`preferred-item${dragOverIndex === index ? " is-drag-over" : ""}`}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverIndex(index);
              }}
              onDragLeave={() => {
                setDragOverIndex((current) => (current === index ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragIndex.current;
                dragIndex.current = null;
                setDragOverIndex(null);
                if (from == null) return;
                moveSlot(from, index);
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setDragOverIndex(null);
              }}
            >
              <span className="preferred-drag" aria-hidden="true" title="Drag to reorder">
                ⋮⋮
              </span>
              <span className="preferred-copy">
                <strong>{RANK_LABELS[index]}</strong>
                {" · "}
                {slot.label}
              </span>
              <span className="preferred-actions">
                <button
                  type="button"
                  className="preferred-move"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveSlot(index, index - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="preferred-move"
                  aria-label="Move down"
                  disabled={index === selectedSlots.length - 1}
                  onClick={() => moveSlot(index, index + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="preferred-remove"
                  onClick={() => removeSlot(slot.start)}
                  aria-label={`Remove ${slot.label}`}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">No times selected yet.</p>
      )}
    </div>
  );
}
