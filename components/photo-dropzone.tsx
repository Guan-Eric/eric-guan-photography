"use client";

import {
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

function isFileDrag(event: DragEvent) {
  return [...event.dataTransfer.types].includes("Files");
}

export function PhotoDropzone({
  onFiles,
  disabled = false,
  accept = "image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic",
  multiple = true,
  className = "",
  children,
  label = "Drop photos here or choose files",
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function emit(list: FileList | File[] | null) {
    if (disabled || !list) return;
    const files = Array.from(list);
    if (files.length > 0) onFiles(files);
  }

  function onDragEnter(event: DragEvent) {
    if (disabled || !isFileDrag(event)) return;
    event.preventDefault();
    depth.current += 1;
    setActive(true);
  }

  function onDragLeave(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  }

  function onDragOver(event: DragEvent) {
    if (disabled || !isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    depth.current = 0;
    setActive(false);
    emit(event.dataTransfer.files);
  }

  return (
    <div
      className={`photo-dropzone${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = "";
        }}
      />
      {children ?? (
        <button
          type="button"
          className="photo-dropzone-prompt"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <span>{label}</span>
          <span className="muted">JPEG, PNG, or WebP</span>
        </button>
      )}
      {children ? (
        <div className="photo-dropzone-actions">
          <button
            type="button"
            className="btn btn-outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose files
          </button>
        </div>
      ) : null}
    </div>
  );
}
