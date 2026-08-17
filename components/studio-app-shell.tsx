"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CoachTour, type CoachStep } from "@/components/coach-tour";
import { toastSuccess } from "@/lib/toast";

const NAV = [
  {
    href: "/admin",
    label: "Orders",
    tour: "orders",
    match: (path: string) => path === "/admin",
  },
  {
    href: "/admin/today",
    label: "Today",
    tour: "today",
    match: (path: string) => path.startsWith("/admin/today"),
  },
  {
    href: "/admin/listings",
    label: "Listings",
    tour: "listings",
    match: (path: string) => path.startsWith("/admin/listings"),
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    tour: "reviews",
    match: (path: string) => path.startsWith("/admin/reviews"),
  },
  {
    href: "/admin/work",
    label: "Work",
    tour: "work",
    match: (path: string) => path.startsWith("/admin/work"),
  },
  {
    href: "/admin/pricing",
    label: "Pricing",
    tour: "pricing",
    match: (path: string) => path.startsWith("/admin/pricing"),
  },
  {
    href: "/admin/booking",
    label: "Booking",
    tour: "booking",
    match: (path: string) => path.startsWith("/admin/booking"),
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    tour: "schedule",
    match: (path: string) => path.startsWith("/admin/schedule"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    tour: "settings",
    match: (path: string) => path.startsWith("/admin/settings"),
  },
];

const PHOTO_TOUR: CoachStep[] = [
  {
    selector: '[data-tour="work"]',
    title: "Add your portfolio",
    body: "Upload a hero and listing photos so agents see real work on your site.",
  },
  {
    selector: '[data-tour="schedule"]',
    title: "Set your hours",
    body: "Weekly availability and slot interval drive what agents can book.",
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
  children,
}: {
  studioName: string;
  slug: string;
  email: string;
  siteUrl: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      toastSuccess("Signed out.");
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="studio-app">
      <aside className="studio-rail">
        <div>
          <Link className="studio-rail-brand" href="/admin">
            {studioName}
          </Link>
          <p className="studio-rail-slug">{slug}</p>
        </div>
        <nav className="studio-rail-nav" aria-label="Studio">
          {NAV.map((item) => (
            <Link
              key={item.href}
              className={item.match(pathname) ? "is-active" : ""}
              href={item.href}
              data-tour={item.tour}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="studio-rail-foot">
          <a className="studio-rail-view" href={siteUrl} target="_blank" rel="noreferrer">
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
  );
}
