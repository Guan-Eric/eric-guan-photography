"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { moveSelectionBlock } from "@/lib/upload-queue";

export type SortablePhotoItem = {
  id: string;
  src: string;
  label?: string;
  /** Soften thumbnail (e.g. uploading placeholder). */
  queued?: boolean;
  /** Overlay progress 0–100. */
  progress?: number;
  statusLabel?: string;
};

function SortableTile({
  item,
  index,
  showIndex,
  selected,
  dropBefore,
  disabled,
  onSelectClick,
  onCheckClick,
  onTileActivate,
  children,
}: {
  item: SortablePhotoItem;
  index: number;
  showIndex?: boolean;
  selected: boolean;
  dropBefore: boolean;
  disabled?: boolean;
  onSelectClick: (event: MouseEvent, id: string) => void;
  onCheckClick: (event: MouseEvent, id: string) => void;
  onTileActivate?: (id: string) => void;
  children?: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`delivery-photo-card sortable-photo-tile${item.queued ? " is-queued" : ""}${selected ? " is-selected" : ""}${dropBefore ? " is-drop-before" : ""}${isDragging ? " is-dragging" : ""}`}
      onClick={(event) => onSelectClick(event, item.id)}
      onDoubleClick={() => onTileActivate?.(item.id)}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className={`delivery-photo-check${selected ? " is-on" : ""}`}
        aria-label={
          selected
            ? `Deselect ${item.label ?? "photo"}`
            : `Select ${item.label ?? "photo"}`
        }
        aria-pressed={selected}
        disabled={disabled}
        onClick={(event) => onCheckClick(event, item.id)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      {showIndex ? (
        <span className="delivery-photo-index">{index + 1}</span>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.src} alt={item.label ?? ""} draggable={false} />
      {item.label ? (
        <span className="delivery-photo-name">{item.label}</span>
      ) : null}
      {typeof item.progress === "number" && item.progress < 100 ? (
        <span className="sortable-photo-progress" aria-hidden>
          <span style={{ width: `${item.progress}%` }} />
        </span>
      ) : null}
      {item.statusLabel ? (
        <span className="sortable-photo-status">{item.statusLabel}</span>
      ) : null}
      {children}
    </li>
  );
}

export function SortablePhotoGrid({
  items,
  onReorder,
  onSelect,
  selectedIds: controlledSelected,
  disabled = false,
  showIndex = false,
  emptyMessage,
  onActivate,
  className = "",
  hideToolbar = false,
}: {
  items: SortablePhotoItem[];
  onReorder: (ids: string[]) => void;
  onSelect?: (ids: string[]) => void;
  selectedIds?: string[];
  disabled?: boolean;
  showIndex?: boolean;
  emptyMessage?: string;
  /** Fired on double-click / Enter when a single tile is focused via activate. */
  onActivate?: (id: string) => void;
  className?: string;
  hideToolbar?: boolean;
}) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set(),
  );
  const selected = controlledSelected
    ? new Set(controlledSelected)
    : internalSelected;
  const setSelected = useCallback(
    (next: Set<string>) => {
      if (!controlledSelected) setInternalSelected(next);
      onSelect?.([...next]);
    },
    [controlledSelected, onSelect],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragCount, setDragCount] = useState(1);
  const anchorRef = useRef<string | null>(null);
  const dragIdsRef = useRef<string[]>([]);
  const didDragRef = useRef(false);

  useEffect(() => {
    const valid = new Set(items.map((item) => item.id));
    const next = new Set([...selected].filter((id) => valid.has(id)));
    if (next.size !== selected.size) setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when items change
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const toggleId = useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
      anchorRef.current = id;
    },
    [selected, setSelected],
  );

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
    [items, setSelected],
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
    if (event.metaKey || event.ctrlKey) {
      toggleId(id);
      return;
    }
    toggleId(id);
  }

  function onCheckClick(event: MouseEvent, id: string) {
    event.stopPropagation();
    if (disabled) return;
    if (event.shiftKey) selectRange(id);
    else toggleId(id);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setSelected(new Set(items.map((item) => item.id)));
    }
    if (event.key === "Escape") {
      setSelected(new Set());
    }
  }

  function onDragStart(event: DragStartEvent) {
    if (disabled) return;
    didDragRef.current = true;
    const id = String(event.active.id);
    let ids = selected.has(id) ? [...selected] : [id];
    if (!selected.has(id)) {
      setSelected(new Set([id]));
      anchorRef.current = id;
    }
    ids = items.filter((item) => ids.includes(item.id)).map((item) => item.id);
    dragIdsRef.current = ids;
    setDragCount(ids.length);
    setActiveId(id);
  }

  function onDragOver(event: { over: { id: string | number } | null }) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverId(null);
    setDragCount(1);
    const dragIds = dragIdsRef.current;
    dragIdsRef.current = [];
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
    if (disabled || !event.over || dragIds.length === 0) return;

    const overIdValue = String(event.over.id);
    const dropIndex = items.findIndex((item) => item.id === overIdValue);
    if (dropIndex < 0) return;

    let next: SortablePhotoItem[];
    if (dragIds.length === 1) {
      const from = items.findIndex((item) => item.id === dragIds[0]);
      if (from < 0 || from === dropIndex) return;
      next = arrayMove(items, from, dropIndex);
    } else {
      next = moveSelectionBlock(items, new Set(dragIds), dropIndex);
    }
    const nextIds = next.map((item) => item.id);
    const same =
      nextIds.length === items.length &&
      nextIds.every((id, index) => id === items[index]?.id);
    if (!same) onReorder(nextIds);
  }

  function onDragCancel() {
    setActiveId(null);
    setOverId(null);
    setDragCount(1);
    dragIdsRef.current = [];
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }

  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null;
  const selectedCount = selected.size;

  if (items.length === 0) {
    return emptyMessage ? (
      <p className="delivery-photo-empty muted">{emptyMessage}</p>
    ) : null;
  }

  return (
    <div
      className={`sortable-photo-grid${className ? ` ${className}` : ""}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {hideToolbar ? null : selectedCount > 0 ? (
        <div className="delivery-photo-toolbar" role="toolbar" aria-label="Selection">
          <span>{selectedCount} selected</span>
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
          </div>
        </div>
      ) : (
        <div className="delivery-photo-toolbar is-idle">
          <span className="muted">
            Click to select · Shift/Cmd+click · drag to reorder
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <ul className="delivery-photo-grid" aria-label="Photos">
            {items.map((item, index) => (
              <SortableTile
                key={item.id}
                item={item}
                index={index}
                showIndex={showIndex}
                selected={selected.has(item.id)}
                dropBefore={overId === item.id && activeId !== item.id}
                disabled={disabled}
                onSelectClick={onCardClick}
                onCheckClick={onCheckClick}
                onTileActivate={onActivate}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div className="sortable-photo-overlay">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeItem.src} alt="" />
              {dragCount > 1 ? (
                <span className="sortable-photo-overlay-count">
                  {dragCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export { moveSelectionBlock };
