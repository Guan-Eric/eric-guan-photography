"use client";

import { useEffect, useState } from "react";
import {
  onToast,
  onToastDismiss,
  toastDismiss,
  type ToastPayload,
} from "@/lib/toast";

export function ActionToastHost() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const offAdd = onToast((toast) => {
      setItems((current) => [...current.filter((item) => item.id !== toast.id), toast]);
      if (toast.durationMs && toast.durationMs > 0) {
        window.setTimeout(() => toastDismiss(toast.id), toast.durationMs);
      }
    });
    const offDismiss = onToastDismiss((id) => {
      setItems((current) => current.filter((item) => item.id !== id));
    });
    return () => {
      offAdd();
      offDismiss();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="action-toast-host" role="status" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`action-toast action-toast--${item.kind}`}
          data-kind={item.kind}
        >
          <span className="action-toast-mark" aria-hidden="true" />
          <p>{item.message}</p>
          <button
            type="button"
            className="action-toast-close"
            aria-label="Dismiss"
            onClick={() => toastDismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
