"use client";

import { useState } from "react";

export function ReviewForm({ token, propertyAddress }: { token: string; propertyAddress: string }) {
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, body, rating }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not save the review.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p>Thank you — that helps the next agent book with confidence.</p>;
  }

  return (
    <form className="booking-card" onSubmit={submit}>
      <h1>How was the shoot?</h1>
      <p className="muted">{propertyAddress}</p>
      <label className="field">
        <span>Rating</span>
        <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} / 5
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Your review</span>
        <textarea
          rows={5}
          value={body}
          required
          minLength={8}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
