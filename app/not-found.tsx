import Link from "next/link";
import { headers } from "next/headers";
import {
  hostnameFromHost,
  isPlatformHostname,
  platformName,
  platformPublicUrl,
  platformRootDomain,
} from "@/lib/platform";

export default async function NotFound() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ||
    headerStore.get("host") ||
    "";
  const hostname = hostnameFromHost(host);
  const path =
    headerStore.get("x-pathname") ||
    headerStore.get("x-invoke-path") ||
    headerStore.get("next-url") ||
    "";
  const platform = isPlatformHostname(hostname);
  const name = platformName();
  const root = platformRootDomain();
  const platformUrl = platformPublicUrl().replace(/\/$/, "");

  const studioOnly =
    platform &&
    (path.includes("/book") ||
      path.includes("/prep") ||
      path.startsWith("/p/") ||
      path.includes("/portal"));

  if (studioOnly) {
    return (
      <main className="page-header" id="main">
        <div className="page-header-inner">
          <p className="eyebrow">Studio site</p>
          <h1>This page lives on a studio website</h1>
          <p className="section-copy">
            Booking, prep guides, and property pages are on each photographer’s
            site — usually{" "}
            <code>
              {"{studio}."}
              {root}
            </code>
            , not the main {name} marketing site.
          </p>
          <Link className="btn btn-solid" href="/">
            Go to {name}
          </Link>
        </div>
      </main>
    );
  }

  const looksLikeStudioSubdomain =
    !platform &&
    hostname.endsWith(`.${root}`) &&
    hostname !== root &&
    hostname !== `www.${root}`;

  if (looksLikeStudioSubdomain) {
    return (
      <main className="page-header" id="main">
        <div className="page-header-inner">
          <p className="eyebrow">Studio</p>
          <h1>No studio at this address</h1>
          <p className="section-copy">
            That subdomain isn’t connected to a live studio yet. Check the URL,
            or visit {name}.
          </p>
          <Link className="btn btn-solid" href={platformUrl}>
            Go to {name}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-header" id="main">
      <div className="page-header-inner">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="section-copy">That link may be expired or mistyped.</p>
        <Link className="btn btn-solid" href="/">
          Go home
        </Link>
      </div>
    </main>
  );
}
