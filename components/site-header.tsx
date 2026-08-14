"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Tenant } from "@/lib/tenant-schema";

type Props = {
  tenant: Tenant;
  /**
   * Inner pages have no full-bleed hero behind the header, so it needs an
   * opaque surface immediately rather than only after scrolling.
   */
  solid?: boolean;
};

export function SiteHeader({ tenant, solid = false }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (solid) return;

    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  const className = [
    "site-header",
    solid ? "is-solid" : "",
    scrolled ? "is-scrolled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={className}>
      <Link className="logo" href="/">
        {tenant.studioName}
      </Link>
      <nav className="nav" aria-label="Primary">
        {tenant.nav.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <Link className="header-cta" href="/book">
        Book a listing
      </Link>
    </header>
  );
}
