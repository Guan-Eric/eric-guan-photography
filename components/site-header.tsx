"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (solid) return;

    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const className = [
    "site-header",
    solid ? "is-solid" : "",
    scrolled ? "is-scrolled" : "",
    menuOpen ? "is-menu-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={className}>
      <Link className="logo" href="/" onClick={() => setMenuOpen(false)}>
        {tenant.studioName}
      </Link>
      <nav className="nav" id={menuId} aria-label="Primary" data-open={menuOpen}>
        {tenant.nav.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link className="nav-mobile-cta" href="/book" onClick={() => setMenuOpen(false)}>
          Book a listing
        </Link>
      </nav>
      <div className="header-actions">
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link className="header-cta" href="/book">
          Book a listing
        </Link>
      </div>
    </header>
  );
}
