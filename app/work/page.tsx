import { redirect } from "next/navigation";

/** Convenience alias — admin Work lives under /admin/work. */
export default function WorkAliasPage() {
  redirect("/admin/work");
}
