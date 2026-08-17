"use client";

import { useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

export function PortalSignOut() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/portal/logout", { method: "POST" });
      toastSuccess("Signed out.");
      window.location.href = "/portal/login";
    } catch {
      toastError("Could not sign out. Try again.");
      setBusy(false);
    }
  }

  return (
    <button
      className={`btn btn-outline${busy ? " is-busy" : ""}`}
      type="button"
      disabled={busy}
      onClick={() => void signOut()}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
