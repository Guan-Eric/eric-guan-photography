"use client";

import { useState } from "react";

/** Enquiry form on a listing page; posts to the tenant-scoped lead route. */
export function ListingLeadForm({ slug, agentName }: { slug: string; agentName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/p/${slug}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not send that. Try again.");
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="listing-lead">
        <h2>Message sent</h2>
        <p>{agentName} will reply to {email}.</p>
      </section>
    );
  }

  return (
    <section className="listing-lead">
      <h2>Ask about this home</h2>
      <form className="listing-lead-form" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
          />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="I would like to see this home this weekend."
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-solid" disabled={busy}>
          {busy ? "Sending…" : `Message ${agentName.split(" ")[0]}`}
        </button>
      </form>
    </section>
  );
}
