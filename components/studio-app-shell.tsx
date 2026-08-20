"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CoachTour, type CoachStep } from "@/components/coach-tour";
import { UnsavedChangesProvider } from "@/components/unsaved-changes";
import { toastSuccess } from "@/lib/toast";

const NAV = [
  {
    href: "/admin",
    label: "Orders",
    tour: "orders",
    group: "Shoots",
    match: (path: string) => path === "/admin",
  },
  {
    href: "/admin/today",
    label: "Today",
    tour: "today",
    group: "Shoots",
    match: (path: string) => path.startsWith("/admin/today"),
  },
  {
    href: "/admin/work",
    label: "Work",
    tour: "work",
    group: "Site",
    match: (path: string) => path.startsWith("/admin/work"),
  },
  {
    href: "/admin/pricing",
    label: "Pricing",
    tour: "pricing",
    group: "Site",
    match: (path: string) => path.startsWith("/admin/pricing"),
  },
  {
    href: "/admin/booking",
    label: "Booking",
    tour: "booking",
    group: "Site",
    match: (path: string) => path.startsWith("/admin/booking"),
  },
  {
    href: "/admin/listings",
    label: "Listings",
    tour: "listings",
    group: "Site",
    match: (path: string) => path.startsWith("/admin/listings"),
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    tour: "reviews",
    group: "Site",
    match: (path: string) => path.startsWith("/admin/reviews"),
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    tour: "schedule",
    group: "Studio",
    match: (path: string) => path.startsWith("/admin/schedule"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    tour: "settings",
    group: "Studio",
    match: (path: string) => path.startsWith("/admin/settings"),
  },
] as const;

const NAV_GROUPS = ["Shoots", "Site", "Studio"] as const;

function publicHost(siteUrl: string, slug: string) {
  try {
    return new URL(siteUrl).host;
  } catch {
    return `${slug}.studiofront.ca`;
  }
}

const PHOTO_TOUR: CoachStep[] = [
  {
    selector: '[data-tour="work"]',
    title: "Add your portfolio",
    body: "Upload a hero and listing photos so agents see real work on your site.",
  },
  {
    selector: '[data-tour="schedule"]',
    title: "Set your hours",
    body: "Weekly availability, slot interval, and Google Calendar sync drive what agents can book.",
  },
  {
    selector: '[data-tour="pricing"]',
    title: "Confirm packages",
    body: "Edit package prices and square-footage bands before you share the book link.",
  },
  {
    selector: '[data-tour="settings"]',
    title: "Connect payouts",
    body: "Finish Stripe Connect here so agents can pay in-gallery and you get paid.",
  },
  {
    selector: '[data-tour="orders"]',
    title: "Run the job board",
    body: "Orders land here. Update status, set a price if needed, upload photos, and share the gallery link.",
  },
];

export function StudioAppShell({
  studioName,
  slug,
  email,
  siteUrl,
  activeTenantId,
  studios,
  children,
}: {
  studioName: string;
  slug: string;
  email: string;
  siteUrl: string;
  activeTenantId: string;
  studios: Array<{ tenantId: string; studioName: string; role: string }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function switchStudio(tenantId: string) {
    if (tenantId === activeTenantId) return;
    const response = await fetch("/api/auth/switch-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    if (response.ok) {
      window.location.assign("/admin");
      return;
    }
    router.refresh();
  }

  async function logout() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      toastSuccess("Signed out.");
      window.location.assign("/login");
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <UnsavedChangesProvider>
      <div className="studio-app">
        <aside className="studio-rail">
          <div className="studio-rail-brand-block">
            <p className="studio-rail-kicker">Studio</p>
            <Link className="studio-rail-brand" href="/admin">
              {studioName}
            </Link>
            <p className="studio-rail-slug">{publicHost(siteUrl, slug)}</p>
          </div>
          <nav className="studio-rail-nav" aria-label="Studio">
            {NAV_GROUPS.map((group) => (
              <div key={group} className="studio-rail-group">
                <p className="studio-rail-group-label">{group}</p>
                {NAV.filter((item) => item.group === group).map((item) => (
                  <Link
                    key={item.href}
                    className={item.match(pathname) ? "is-active" : ""}
                    href={item.href}
                    data-tour={item.tour}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="studio-rail-foot">
            {studios.length > 1 ? (
              <label className="field studio-rail-switch">
                <span>Switch studio</span>
                <select
                  value={activeTenantId}
                  onChange={(event) => void switchStudio(event.target.value)}
                  aria-label="Switch studio"
                >
                  {studios.map((studio) => (
                    <option key={studio.tenantId} value={studio.tenantId}>
                      {studio.studioName}
                      {studio.role !== "owner" ? ` (${studio.role})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <a className="btn btn-outline studio-rail-view" href={siteUrl} target="_blank" rel="noreferrer">
              View site
            </a>
            <p>{email}</p>
            <button type="button" onClick={() => void logout()} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>
        <div className="studio-main" id="main">
          {children}
        </div>
        <CoachTour tourId="photo_v1" steps={PHOTO_TOUR} />
      </div>
    </UnsavedChangesProvider>
  );
}
