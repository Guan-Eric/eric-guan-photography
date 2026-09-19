"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

export type DeliveryPhotoItem = {
  id: string;
  name: string;
  src: string;
};

function moveSelectionBlock<T extends { id: string }>(
  list: T[],
  selectedIds: Set<string>,
  dropIndex: number,
): T[] {
  if (selectedIds.size === 0) return list;
  const selected = list.filter((item) => selectedIds.has(item.id));
  const remaining = list.filter((item) => !selectedIds.has(item.id));
  const removedBefore = list
    .slice(0, dropIndex)
    .filter((item) => selectedIds.has(item.id)).length;
  const insertAt = Math.max(
    0,
    Math.min(remaining.length, dropIndex - removedBefore),
  );
  return [
    ...remaining.slice(0, insertAt),
    ...selected,
    ...remaining.slice(insertAt),
  ];
}

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic)$/i.test(file.name);
}

export function DeliveryPhotoBrowser({
  items,
  disabled = false,
  showIndex = false,
  emptyMessage,
  acceptDrops = false,
  queuedStyle = false,
  onReorder,
  onRemove,
  onDropFiles,
  onClearAll,
  clearAllLabel = "Clear all",
}: {
  items: DeliveryPhotoItem[];
  disabled?: boolean;
  showIndex?: boolean;
  emptyMessage: string;
  /** Enable desktop file drops onto the panel. */
  acceptDrops?: boolean;
  /** Soften thumbnails for the staging queue. */
  queuedStyle?: boolean;
  onReorder: (orderedIds: string[]) => void;
  onRemove: (ids: string[]) => void;
  onDropFiles?: (files: File[]) => void;
  onClearAll?: () => void;
  clearAllLabel?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [fileDropActive, setFileDropActive] = useState(false);
  const anchorRef = useRef<string | null>(null);
  const dragIdsRef = useRef<string[] | null>(null);
  const didDragRef = useRef(false);
  const fileDragDepth = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected((current) => {
      const next = new Set(
        [...current].filter((id) => items.some((item) => item.id === id)),
      );
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const toggleId = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchorRef.current = id;
  }, []);

  const selectRange = useCallback(
    (toId: string) => {
      const fromId = anchorRef.current ?? toId;
      const from = items.findIndex((item) => item.id === fromId);
      const to = items.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) {
        setSelected(new Set([toId]));
        anchorRef.current = toId;
        return;
      }
      const [start, end] = from < to ? [from, to] : [to, from];
      setSelected(new Set(items.slice(start, end + 1).map((item) => item.id)));
    },
    [items],
  );

  function onCardClick(event: MouseEvent, id: string) {
    if (disabled) return;
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      selectRange(id);
      return;
    }
    // Plain click (and Cmd/Ctrl) toggles — multi-select without a modifier.
    toggleId(id);
  }

  function removeSelected() {
    if (disabled || selected.size === 0) return;
    onRemove([...selected]);
    setSelected(new Set());
  }

  function onKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setSelected(new Set(items.map((item) => item.id)));
      return;
    }
    if (event.key === "Escape") {
      setSelected(new Set());
      return;
    }
    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      selected.size > 0
    ) {
      event.preventDefault();
      removeSelected();
    }
  }

  function onDragStart(event: DragEvent, id: string) {
    if (disabled) return;
    didDragRef.current = true;
    let ids = selected.has(id) ? [...selected] : [id];
    if (!selected.has(id)) {
      setSelected(new Set([id]));
      anchorRef.current = id;
    }
    // Preserve gallery order among selected ids
    ids = items.filter((item) => ids.includes(item.id)).map((item) => item.id);
    dragIdsRef.current = ids;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ids.join(","));
  }

  function onDragOverCard(event: DragEvent, id: string) {
    if (disabled || !dragIdsRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(id);
  }

  function onDropOnCard(event: DragEvent, targetId: string) {
    event.preventDefault();
    setDropTargetId(null);
    if (disabled) return;
    const dragIds = dragIdsRef.current;
    dragIdsRef.current = null;
    if (!dragIds?.length) return;
    const dropIndex = items.findIndex((item) => item.id === targetId);
    if (dropIndex < 0) return;
    const next = moveSelectionBlock(items, new Set(dragIds), dropIndex);
    const nextIds = next.map((item) => item.id);
    const same =
      nextIds.length === items.length &&
      nextIds.every((id, index) => id === items[index]?.id);
    if (!same) onReorder(nextIds);
  }

  function onDragEnd() {
    dragIdsRef.current = null;
    setDropTargetId(null);
    // Click fires after dragend — ignore that click.
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }

  function onFileDragEnter(event: DragEvent) {
    if (!acceptDrops || disabled || !onDropFiles) return;
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    fileDragDepth.current += 1;
    setFileDropActive(true);
  }

  function onFileDragLeave(event: DragEvent) {
    if (!acceptDrops) return;
    event.preventDefault();
    fileDragDepth.current = Math.max(0, fileDragDepth.current - 1);
    if (fileDragDepth.current === 0) setFileDropActive(false);
  }

  function onFileDragOver(event: DragEvent) {
    if (!acceptDrops || disabled || !onDropFiles) return;
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onFileDrop(event: DragEvent) {
    if (!acceptDrops || disabled || !onDropFiles) return;
    event.preventDefault();
    fileDragDepth.current = 0;
    setFileDropActive(false);
    const files = [...event.dataTransfer.files].filter(isImageFile);
    if (files.length > 0) onDropFiles(files);
  }

  const selectedCount = selected.size;

  return (
    <div
      ref={rootRef}
      className={`delivery-photo-browser${fileDropActive ? " is-drop-target" : ""}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragEnter={onFileDragEnter}
      onDragLeave={onFileDragLeave}
      onDragOver={onFileDragOver}
      onDrop={onFileDrop}
    >
      {selectedCount > 0 ? (
        <div className="delivery-photo-toolbar" role="toolbar" aria-label="Selection">
          <span>
            {selectedCount} selected
          </span>
          <div className="delivery-photo-toolbar-actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={disabled || selectedCount === items.length}
              onClick={() =>
                setSelected(new Set(items.map((item) => item.id)))
              }
            >
              Select all
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={disabled}
              onClick={() => setSelected(new Set())}
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
                  setSelected(new Set());
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
            Click to multi-select · Shift+click for a range · drag to reorder
          </span>
          {onClearAll ? (
            <button
              type="button"
              className="btn btn-outline"
              disabled={disabled}
              onClick={() => {
                onClearAll();
                setSelected(new Set());
              }}
            >
              {clearAllLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="delivery-photo-grid" aria-label="Photos">
          {items.map((item, index) => {
            const isSelected = selected.has(item.id);
            const isDropTarget = dropTargetId === item.id;
            return (
              <li
                key={item.id}
                className={`delivery-photo-card${queuedStyle ? " is-queued" : ""}${isSelected ? " is-selected" : ""}${isDropTarget ? " is-drop-before" : ""}`}
                draggable={!disabled}
                onDragStart={(event) => onDragStart(event, item.id)}
                onDragOver={(event) => onDragOverCard(event, item.id)}
                onDrop={(event) => onDropOnCard(event, item.id)}
                onDragEnd={onDragEnd}
                onClick={(event) => onCardClick(event, item.id)}
              >
                <button
                  type="button"
                  className={`delivery-photo-check${isSelected ? " is-on" : ""}`}
                  aria-label={
                    isSelected ? `Deselect ${item.name}` : `Select ${item.name}`
                  }
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (disabled) return;
                    if (event.shiftKey) selectRange(item.id);
                    else toggleId(item.id);
                  }}
                />
                {showIndex ? (
                  <span className="delivery-photo-index">{index + 1}</span>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.name} draggable={false} />
                <span className="delivery-photo-name">{item.name}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="delivery-photo-empty muted">
          {acceptDrops
            ? `${emptyMessage} Or drag photos here.`
            : emptyMessage}
        </p>
      )}
    </div>
  );
}
