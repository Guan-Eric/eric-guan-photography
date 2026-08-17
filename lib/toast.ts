export type ToastKind = "success" | "error" | "info" | "loading";

export type ToastPayload = {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs?: number;
};

const EVENT = "sf-toast";

function emit(payload: Omit<ToastPayload, "id"> & { id?: string }) {
  if (typeof window === "undefined") return "";
  const id = payload.id ?? `toast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(EVENT, {
      detail: { ...payload, id },
    }),
  );
  return id;
}

export function toastSuccess(message: string) {
  return emit({ kind: "success", message, durationMs: 4200 });
}

export function toastError(message: string) {
  return emit({ kind: "error", message, durationMs: 7000 });
}

export function toastInfo(message: string) {
  return emit({ kind: "info", message, durationMs: 4200 });
}

export function toastLoading(message: string) {
  return emit({ kind: "loading", message, durationMs: 0 });
}

export function toastDismiss(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sf-toast-dismiss", { detail: { id } }));
}

export function onToast(handler: (toast: ToastPayload) => void) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<ToastPayload>).detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function onToastDismiss(handler: (id: string) => void) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<{ id: string }>).detail.id);
  };
  window.addEventListener("sf-toast-dismiss", listener);
  return () => window.removeEventListener("sf-toast-dismiss", listener);
}
