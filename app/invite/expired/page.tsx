import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = {
  title: "Invite expired",
  robots: { index: false, follow: false },
};

export default function InviteExpiredPage() {
  return (
    <AuthShell line="Join the studio that invited you.">
      <div className="auth-form-intro">
        <h1>Invite expired</h1>
        <p>Ask the studio owner to send a new invite.</p>
        <p className="auth-form-foot">
          <a href="/login">Sign in</a>
          {" · "}
          <a href="/signup">Create account</a>
        </p>
      </div>
    </AuthShell>
  );
}
