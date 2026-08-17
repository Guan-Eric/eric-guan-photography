"use client";

import { useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

export function PrepShareActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toastSuccess("Link copied.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      toastError("Could not copy the link.");
    }
  }

  return (
    <div className="prep-share-actions">
      <button type="button" className="btn btn-outline" onClick={() => void copyLink()}>
        {copied ? "Link copied" : "Copy link for seller"}
      </button>
      <button type="button" className="btn btn-outline" onClick={() => window.print()}>
        Print checklist
      </button>
    </div>
  );
}
