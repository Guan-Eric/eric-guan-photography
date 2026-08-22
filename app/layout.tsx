import type { Metadata, Viewport } from "next";
import { Figtree, Syne } from "next/font/google";
import { ActionToastHost } from "@/components/action-toast";
import {
  platformName,
  platformPublicUrl,
  platformSeo,
  platformTheme,
} from "@/lib/platform";
import { getRequestTenant, requestTheme, themeStyle } from "@/lib/tenants";
import "./globals.css";

export const dynamic = "force-dynamic";

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

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  if (!tenant) {
    const seo = platformSeo();
    const url = platformPublicUrl();
    return {
      metadataBase: new URL(url),
      title: {
        default: seo.title,
        template: `%s — ${platformName()}`,
      },
      description: seo.description,
      alternates: { canonical: "/" },
      openGraph: {
        type: "website",
        siteName: platformName(),
        title: seo.title,
        description: seo.description,
        url,
      },
      twitter: {
        card: "summary_large_image",
        title: seo.title,
        description: seo.description,
      },
      robots: { index: true, follow: true },
    };
  }

  const defaultTitle =
    tenant.seo.title?.trim() ||
    `${tenant.studioName} — Real Estate Photography`;

  return {
    metadataBase: new URL(tenant.siteUrl),
    title: {
      default: defaultTitle,
      template: `%s — ${tenant.studioName}`,
    },
    description: tenant.seo.description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: tenant.studioName,
      title: defaultTitle,
      description: tenant.seo.description,
      url: tenant.siteUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: tenant.seo.description,
    },
    robots: { index: true, follow: true },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const tenant = await getRequestTenant();
  return { themeColor: requestTheme(tenant).bg };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getRequestTenant();
  const theme = tenant?.theme ?? platformTheme();

  return (
    <html
      lang="en"
      className={`${syne.variable} ${figtree.variable}`}
      style={themeStyle(theme)}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="noise" aria-hidden="true" />
        {children}
        <ActionToastHost />
      </body>
    </html>
  );
}
