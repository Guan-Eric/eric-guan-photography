"use client";

import { useEffect } from "react";

export function StickySaveBar({
  dirty,
  busy = false,
  label = "Save",
  formId,
  onSave,
}: {
  dirty: boolean;
  busy?: boolean;
  label?: string;
  formId?: string;
  onSave?: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") {
        return;
      }
      event.preventDefault();
      if (busy || !dirty) return;
      if (onSave) {
        onSave();
        return;
      }
      if (formId) {
        const form = document.getElementById(formId);
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, dirty, formId, onSave]);

  return (
    <div className={`sticky-save-bar${dirty ? " is-dirty" : ""}`} role="status">
      <p className="sticky-save-bar-copy">
        {dirty ? "Unsaved changes" : "All changes saved"}
      </p>
      <button
        type={formId && !onSave ? "submit" : "button"}
        form={formId && !onSave ? formId : undefined}
        className={`btn btn-solid${busy ? " is-busy" : ""}`}
        disabled={busy || !dirty}
        onClick={onSave}
      >
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}
