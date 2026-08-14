"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "Orders", match: (path: string) => path === "/admin" },
  { href: "/admin/work", label: "Work", match: (path: string) => path.startsWith("/admin/work") },
  {
    href: "/admin/pricing",
    label: "Pricing",
    match: (path: string) => path.startsWith("/admin/pricing"),
  },
  {
    href: "/admin/booking",
    label: "Booking",
    match: (path: string) => path.startsWith("/admin/booking"),
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    match: (path: string) => path.startsWith("/admin/schedule"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    match: (path: string) => path.startsWith("/admin/settings"),
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
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
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
    </div>
  );
}
