import type { Metadata } from "next";
import { redirect } from "next/navigation";

/** Convenience alias — admin Work lives under /admin/work. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function WorkAliasPage() {
  redirect("/admin/work");
}
