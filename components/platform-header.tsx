"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { platformName } from "@/lib/platform-public";

export function PlatformHeader({ solid = false }: { solid?: boolean }) {
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
    solid ? "is-solid" : "on-media",
    scrolled ? "is-scrolled" : "",
    menuOpen ? "is-menu-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={className}>
      <Link className="logo" href="/" onClick={() => setMenuOpen(false)}>
        {platformName()}
      </Link>
      <nav className="nav" id={menuId} aria-label="Primary" data-open={menuOpen}>
        <Link href="/#product" onClick={() => setMenuOpen(false)}>
          Product
        </Link>
        <Link href="/pricing" onClick={() => setMenuOpen(false)}>
          Pricing
        </Link>
        <Link href="/login" onClick={() => setMenuOpen(false)}>
          Sign in
        </Link>
        <Link className="nav-mobile-cta" href="/signup" onClick={() => setMenuOpen(false)}>
          Start free trial
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
        <Link className="header-cta" href="/signup">
          Start free trial
        </Link>
      </div>
    </header>
  );
}
