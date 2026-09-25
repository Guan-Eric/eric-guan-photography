"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import {
  SortablePhotoGrid,
  type SortablePhotoItem,
} from "@/components/sortable-photo-grid";

export type DeliveryPhotoItem = {
  id: string;
  name: string;
  src: string;
  queued?: boolean;
  progress?: number;
  statusLabel?: string;
};

export function DeliveryPhotoBrowser({
  items,
  disabled = false,
  showIndex = false,
  emptyMessage,
  onReorder,
  onRemove,
  onClearAll,
  clearAllLabel = "Clear all",
  onActivate,
}: {
  items: DeliveryPhotoItem[];
  disabled?: boolean;
  showIndex?: boolean;
  emptyMessage: string;
  onReorder: (orderedIds: string[]) => void;
  onRemove?: (ids: string[]) => void;
  onClearAll?: () => void;
  clearAllLabel?: string;
  onActivate?: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected((current) =>
      current.filter((id) => items.some((item) => item.id === id)),
    );
  }, [items]);

  const gridItems: SortablePhotoItem[] = items.map((item) => ({
    id: item.id,
    src: item.src,
    label: item.name,
    queued: item.queued,
    progress: item.progress,
    statusLabel: item.statusLabel,
  }));

  function removeSelected() {
    if (disabled || selected.length === 0 || !onRemove) return;
    onRemove(selected);
    setSelected([]);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      selected.length > 0 &&
      onRemove
    ) {
      event.preventDefault();
      removeSelected();
    }
  }

  return (
    <div
      className="delivery-photo-browser"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {selected.length > 0 && onRemove ? (
        <div className="delivery-photo-toolbar" role="toolbar" aria-label="Actions">
          <span>{selected.length} selected</span>
          <div className="delivery-photo-toolbar-actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={disabled || selected.length === items.length}
              onClick={() =>
                setSelected(items.map((item) => item.id))
              }
            >
              Select all
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={disabled}
              onClick={() => setSelected([])}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-outline delivery-photo-remove"
              disabled={disabled}
              onClick={removeSelected}
            >
              Remove selected
            </button>
            {onClearAll && items.length > 0 ? (
              <button
                type="button"
                className="btn btn-outline"
                disabled={disabled}
                onClick={() => {
                  onClearAll();
                  setSelected([]);
                }}
              >
                {clearAllLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="delivery-photo-toolbar is-idle">
          <span className="muted">
            Click to select · Shift/Cmd+click · drag to reorder
          </span>
          {onClearAll ? (
            <button
              type="button"
              className="btn btn-outline"
              disabled={disabled}
              onClick={() => {
                onClearAll();
                setSelected([]);
              }}
            >
              {clearAllLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <SortablePhotoGrid
        items={gridItems}
        disabled={disabled}
        showIndex={showIndex}
        emptyMessage={emptyMessage}
        selectedIds={selected}
        onSelect={setSelected}
        onReorder={onReorder}
        onActivate={onActivate}
        hideToolbar={Boolean(onRemove)}
      />
    </div>
  );
}
