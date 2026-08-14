import Link from "next/link";
import type { Tenant } from "@/lib/tenant-schema";

export function SiteFooter({ tenant }: { tenant: Tenant }) {
  return (
    <footer className="site-footer">
      <p>
        © {new Date().getFullYear()} {tenant.studioName} · Real Estate Photography
      </p>
      <div className="footer-links">
        <Link href="/pricing">Pricing</Link>
        <Link href="/prep">Before your shoot</Link>
        <a href={`mailto:${tenant.email}`}>Email</a>
      </div>
    </footer>
  );
}
