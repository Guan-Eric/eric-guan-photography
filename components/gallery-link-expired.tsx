import { StatusPage } from "@/components/status-page";

export function GalleryLinkExpired() {
  return (
    <StatusPage
      shell="delivery"
      eyebrow="Link expired"
      title="This gallery link is no longer active"
      body="Ask your photographer for a fresh link. Preview and download links expire after 14 days, and the preview link stops working after payment unlocks a new download URL."
      actions={[{ href: "/portal", label: "Agent portal", variant: "outline" }]}
    />
  );
}
