"use client";

export function PortalSignOut() {
  return (
    <button
      className="btn btn-outline"
      type="button"
      onClick={() => {
        void fetch("/api/portal/logout", { method: "POST" }).then(() => {
          window.location.href = "/portal/login";
        });
      }}
    >
      Sign out
    </button>
  );
}
