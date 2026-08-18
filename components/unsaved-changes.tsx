"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

const CONFIRM_MESSAGE = "You have unsaved changes. Leave this page?";

type UnsavedChangesContextValue = {
  setDirty: (dirty: boolean) => void;
  confirmLeave: () => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyRef = useRef(false);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const confirmLeave = useCallback(() => {
    if (!dirtyRef.current) return true;
    return window.confirm(CONFIRM_MESSAGE);
  }, []);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    function onClick(event: Event) {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      if (/^https?:/i.test(href)) return;
      const url = new URL(href, window.location.origin);
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    const root = document.querySelector(".studio-app");
    root?.addEventListener("click", onClick, true);
    return () => root?.removeEventListener("click", onClick, true);
  }, [confirmLeave]);

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, confirmLeave }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(dirty: boolean) {
  const ctx = useContext(UnsavedChangesContext);
  useEffect(() => {
    ctx?.setDirty(dirty);
    return () => ctx?.setDirty(false);
  }, [ctx, dirty]);
}
