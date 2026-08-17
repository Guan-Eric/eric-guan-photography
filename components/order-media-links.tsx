"use client";

import { useEffect, useRef, useState } from "react";
import { kindLabel, parseEmbed, providerLabel } from "@/lib/embeds";
import type { EmbedProvider, MediaLinkKind } from "@/lib/embeds";
import { toastError, toastSuccess } from "@/lib/toast";

type LinkRow = {
  id: string;
  kind: MediaLinkKind;
  provider: string;
  url: string | null;
  storagePath: string | null;
  title: string | null;
  brandMode: "branded" | "unbranded" | "both";
};

const KINDS: MediaLinkKind[] = ["video", "tour", "floorplan"];

/**
 * Attach video / 3D tour links and floor-plan PDFs to a shoot. Rendered only
 * inside an expanded order card, so the fetch is naturally lazy.
 */
export function OrderMediaLinks({ orderId }: { orderId: string }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MediaLinkKind>("video");
  const [brandMode, setBrandMode] = useState<"both" | "branded" | "unbranded">("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/admin/orders/${orderId}/links`);
      const json = await response.json().catch(() => null);
      if (!cancelled && json?.ok) setLinks(json.links ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const preview = url.trim() ? parseEmbed(url, kind) : null;

  async function addLink() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, kind, title, brandMode }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not add that link.");
        toastError(json?.error ?? "Could not add that link.");
        return;
      }
      setLinks((current) => [...current, json.link]);
      setUrl("");
      setTitle("");
      setNotice("Added.");
      toastSuccess("Media link added.");
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPdf() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PDF floor plan first.");
      toastError("Choose a PDF floor plan first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "floorplan");
      form.append("brandMode", brandMode);
      if (title.trim()) form.append("title", title.trim());
      const response = await fetch(`/api/admin/orders/${orderId}/links`, {
        method: "POST",
        body: form,
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Upload failed.");
        toastError(json?.error ?? "Upload failed.");
        return;
      }
      setLinks((current) => [...current, json.link]);
      if (fileRef.current) fileRef.current.value = "";
      setTitle("");
      setNotice("Floor plan uploaded.");
      toastSuccess("Floor plan uploaded.");
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(linkId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/links?linkId=${encodeURIComponent(linkId)}`,
        { method: "DELETE" },
      );
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not remove that item.");
        toastError(json?.error ?? "Could not remove that item.");
        return;
      }
      setLinks((current) => current.filter((link) => link.id !== linkId));
      toastSuccess("Media link removed.");
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="embed-manager">
      <p className="muted">
        Paste a YouTube, Vimeo, Matterport, iGuide or CubiCasa link. Unknown hosts
        still work — they open in a new tab instead of embedding.
      </p>

      <div className="embed-manager-row">
        <label className="field">
          <span>Link</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://my.matterport.com/show/?m=…"
          />
        </label>
        <label className="field">
          <span>Type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as MediaLinkKind)}
          >
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {kindLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Shows on</span>
          <select
            value={brandMode}
            onChange={(event) =>
              setBrandMode(event.target.value as "both" | "branded" | "unbranded")
            }
          >
            <option value="both">Branded + MLS</option>
            <option value="branded">Branded only</option>
            <option value="unbranded">MLS only</option>
          </select>
        </label>
        <button
          type="button"
          className={`btn btn-solid${busy ? " is-busy" : ""}`}
          disabled={busy}
          onClick={addLink}
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>

      <label className="field">
        <span>Label (optional)</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Twilight video"
        />
      </label>

      <div className="embed-manager-row">
        <label className="field">
          <span>Floor plan PDF</span>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" />
        </label>
        <button
          type="button"
          className={`btn btn-outline${busy ? " is-busy" : ""}`}
          disabled={busy}
          onClick={uploadPdf}
        >
          {busy ? "Uploading…" : "Upload PDF"}
        </button>
      </div>

      {preview ? (
        preview.ok ? (
          <p className="muted">
            Detected {providerLabel(preview.embed.provider as EmbedProvider)} ·{" "}
            {kindLabel(preview.embed.kind)}
            {preview.embed.embedUrl ? " · embeds inline" : " · opens in a new tab"}
          </p>
        ) : (
          <p className="form-error">{preview.error}</p>
        )
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      {links.length > 0 ? (
        <ul className="embed-list">
          {links.map((link) => (
            <li key={link.id}>
              <span>
                <strong>{link.title ?? kindLabel(link.kind)}</strong>{" "}
                <span className="muted">
                  {kindLabel(link.kind)} · {providerLabel(link.provider as EmbedProvider)}
                  {link.brandMode === "both" ? "" : ` · ${link.brandMode} only`}
                </span>
                {link.url ? (
                  <>
                    <br />
                    <code>{link.url}</code>
                  </>
                ) : null}
              </span>
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={() => remove(link.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
