import Link from "next/link";
import { platformName } from "@/lib/platform-public";

export function PlatformFooter() {
  return (
    <footer className="site-footer">
      <p>
        © {new Date().getFullYear()} {platformName()} · Software for real estate photographers
      </p>
      <div className="footer-links">
        <Link href="/pricing">Pricing</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/signup">Start trial</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </div>
    </footer>
  );
}
