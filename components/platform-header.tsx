"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { platformName } from "@/lib/platform-public";

export function PlatformHeader({ solid = false }: { solid?: boolean }) {
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
    solid ? "is-solid" : "on-media",
    scrolled ? "is-scrolled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={className}>
      <Link className="logo" href="/">
        {platformName()}
      </Link>
      <nav className="nav" aria-label="Primary">
        <Link href="/#product">Product</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/login">Sign in</Link>
      </nav>
      <Link className="header-cta" href="/signup">
        Start free trial
      </Link>
    </header>
  );
}
