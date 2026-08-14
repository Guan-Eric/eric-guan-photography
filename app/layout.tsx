import type { Metadata, Viewport } from "next";
import { Figtree, Syne } from "next/font/google";
import { getTenant, themeStyle } from "@/lib/tenants";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-figtree",
  display: "swap",
});

/**
 * Phase 0 serves a single tenant, so this resolves statically and every page
 * can be prerendered. Host-based resolution (`getTenantByHost`) moves into
 * middleware when subdomains and custom domains land.
 */
const tenant = getTenant();

export const metadata: Metadata = {
  metadataBase: new URL(tenant.siteUrl),
  title: {
    default: `${tenant.studioName} — Real Estate Photography`,
    template: `%s — ${tenant.studioName}`,
  },
  description: tenant.seo.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: tenant.studioName,
    title: `${tenant.studioName} — Real Estate Photography`,
    description: tenant.seo.description,
    url: tenant.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${tenant.studioName} — Real Estate Photography`,
    description: tenant.seo.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: tenant.theme.bg,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${figtree.variable}`}
      style={themeStyle(tenant)}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="noise" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
