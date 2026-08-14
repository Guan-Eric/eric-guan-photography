import Image from "next/image";
import Link from "next/link";
import { platformName } from "@/lib/platform-public";

const MEDIA = {
  src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80",
  alt: "Bright living room ready for listing photographs",
};

export function AuthShell({
  line,
  children,
}: {
  line: string;
  children: React.ReactNode;
}) {
  const name = platformName();

  return (
    <div className="auth-gate">
      <aside className="auth-gate-media">
        <Image
          src={MEDIA.src}
          alt={MEDIA.alt}
          fill
          sizes="(max-width: 860px) 100vw, 55vw"
          style={{ objectFit: "cover" }}
          priority
        />
        <div className="auth-gate-veil" aria-hidden="true" />
        <div className="auth-gate-brand">
          <Link className="auth-gate-logo" href="/">
            {name}
          </Link>
          <p>{line}</p>
        </div>
      </aside>
      <div className="auth-gate-panel">
        <div className="auth-gate-form" id="main">
          {children}
        </div>
      </div>
    </div>
  );
}
