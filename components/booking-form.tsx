"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PreferredTimesPicker } from "@/components/preferred-times-picker";
import type { PreferredSlot } from "@/lib/preferred-slots";
import { normalizePostalCode } from "@/lib/service-area";
import type { Package } from "@/lib/tenant-schema";

type Slot = { start: string; end: string; label: string };

type QuoteOk = {
  ok: true;
  packageId: string;
  packageName: string;
  priceCents: number;
  priceLabel: string;
  currency: string;
  durationMinutes: number;
  squareFootage: number;
  bandLabel: string;
};

type Props = {
  packages: Package[];
  defaultPackageId?: string;
  email: string;
};

type FieldKey =
  | "packageId"
  | "squareFootage"
  | "propertyAddress"
  | "postalCode"
  | "city"
  | "preferredSlots"
  | "agentName"
  | "agentEmail";

type FieldErrors = Partial<Record<FieldKey, string>>;

const emptyAccess = {
  occupancy: "vacant" as "vacant" | "occupied",
  accessType: "lockbox" as "lockbox" | "meet" | "key" | "other",
  accessNotes: "",
  pets: "",
  parkingNotes: "",
  meetingContact: "",
};

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span>
      {children}
      {required ? (
        <>
          {" "}
          <abbr className="required-marker" title="Required">
            *
          </abbr>
        </>
      ) : (
        <span className="optional-marker">Optional</span>
      )}
    </span>
  );
}

export function BookingForm({ packages, defaultPackageId, email }: Props) {
  const router = useRouter();
  const bookable = useMemo(
    () => packages.filter((pkg) => pkg.durationMinutes != null),
    [packages],
  );

  const [packageId, setPackageId] = useState(
    defaultPackageId && bookable.some((pkg) => pkg.id === defaultPackageId)
      ? defaultPackageId
      : bookable[0]?.id ?? "",
  );
  const [squareFootage, setSquareFootage] = useState("1800");
  const [quote, setQuote] = useState<QuoteOk | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<PreferredSlot[]>([]);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [triedSubmit, setTriedSubmit] = useState(false);

  const [propertyAddress, setPropertyAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("Montréal");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [notes, setNotes] = useState("");
  const [access, setAccess] = useState(emptyAccess);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const sqft = Number(squareFootage);

    if (!packageId) errors.packageId = "Choose a package.";
    if (!Number.isFinite(sqft) || sqft < 400 || sqft > 20000) {
      errors.squareFootage = "Enter square footage between 400 and 20,000.";
    } else if (!quote) {
      errors.squareFootage = quoteError ?? "Fix the package size to get a quote.";
    }

    if (propertyAddress.trim().length < 5) {
      errors.propertyAddress = "Enter the full property address.";
    }
    if (normalizePostalCode(postalCode).length < 3) {
      errors.postalCode = "Enter a postal or ZIP code.";
    }
    if (!city.trim()) errors.city = "Enter the city.";

    if (selectedSlots.length === 0) {
      errors.preferredSlots = "Add at least one preferred time.";
    }

    if (agentName.trim().length < 2) {
      errors.agentName = "Enter your name.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agentEmail.trim())) {
      errors.agentEmail = "Enter a valid email address.";
    }

    return errors;
  }

  useEffect(() => {
    if (!packageId || !squareFootage) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingQuote(true);
      setQuoteError(null);
      setSelectedSlots([]);
      clearFieldError("preferredSlots");

      try {
        const payload = {
          packageId,
          squareFootage: Number(squareFootage),
        };

        const [quoteRes, slotsRes] = await Promise.all([
          fetch("/api/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }),
          fetch("/api/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }),
        ]);

        const quoteJson = await quoteRes.json();
        const slotsJson = await slotsRes.json();

        if (!quoteJson.ok) {
          setQuote(null);
          setSlots([]);
          setQuoteError(quoteJson.error ?? "Could not quote this package.");
          return;
        }

        setQuote(quoteJson);
        clearFieldError("squareFootage");
        clearFieldError("packageId");
        setSlots(slotsJson.ok ? slotsJson.slots : []);
        if (!slotsJson.ok) {
          setQuoteError(slotsJson.error ?? null);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setQuoteError("Could not load quote. Try again.");
      } finally {
        setLoadingQuote(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [packageId, squareFootage]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTriedSubmit(true);
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Check the highlighted fields.");
      const firstKey = Object.keys(errors)[0];
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          squareFootage: Number(squareFootage),
          propertyAddress,
          postalCode: normalizePostalCode(postalCode),
          city,
          preferredSlots: selectedSlots,
          agentName,
          agentEmail,
          agentPhone: agentPhone || undefined,
          brokerage: brokerage || undefined,
          occupancy: access.occupancy,
          accessType: access.accessType,
          accessNotes: access.accessNotes || undefined,
          pets: access.pets || undefined,
          parkingNotes: access.parkingNotes || undefined,
          meetingContact: access.meetingContact || undefined,
          notes: notes || undefined,
        }),
      });

      const json = await response.json();
      if (!json.ok) {
        const message = json.error ?? "Could not submit the booking.";
        setFormError(message);
        if (/postal/i.test(message) || /Montréal|Montreal|cover/i.test(message)) {
          setFieldErrors({ postalCode: message });
        } else if (/time|slot|preferred/i.test(message)) {
          setFieldErrors({ preferredSlots: message });
        }
        return;
      }

      router.push(
        `/book/confirmation/${json.orderId}?token=${encodeURIComponent(json.publicToken)}${
          json.emailStubbed ? "&local=1" : ""
        }`,
      );
    } catch {
      setFormError("Network error — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="booking-form" onSubmit={onSubmit} noValidate>
      <p className="field-hint form-legend">
        Fields marked <abbr className="required-marker" title="Required">*</abbr> are
        required.
      </p>

      <section className="booking-card">
        <h2>1. Package &amp; size</h2>
        <div className="form-grid">
          <label
            className={`field${fieldErrors.packageId ? " is-invalid" : ""}`}
            data-field="packageId"
          >
            <FieldLabel required>Package</FieldLabel>
            <select
              value={packageId}
              aria-invalid={Boolean(fieldErrors.packageId)}
              aria-describedby={fieldErrors.packageId ? "err-packageId" : undefined}
              onChange={(event) => {
                setPackageId(event.target.value);
                clearFieldError("packageId");
              }}
              required
            >
              {bookable.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.price})
                </option>
              ))}
            </select>
            {fieldErrors.packageId ? (
              <span className="field-error" id="err-packageId">
                {fieldErrors.packageId}
              </span>
            ) : null}
          </label>
          <label
            className={`field${fieldErrors.squareFootage ? " is-invalid" : ""}`}
            data-field="squareFootage"
          >
            <FieldLabel required>Square footage</FieldLabel>
            <input
              type="number"
              min={400}
              max={20000}
              step={50}
              value={squareFootage}
              aria-invalid={Boolean(fieldErrors.squareFootage)}
              aria-describedby={
                fieldErrors.squareFootage ? "err-squareFootage" : undefined
              }
              onChange={(event) => {
                setSquareFootage(event.target.value);
                clearFieldError("squareFootage");
              }}
              required
            />
            {fieldErrors.squareFootage ? (
              <span className="field-error" id="err-squareFootage">
                {fieldErrors.squareFootage}
              </span>
            ) : null}
          </label>
        </div>

        <div className="quote-panel" aria-live="polite">
          {loadingQuote ? <p>Calculating quote…</p> : null}
          {quoteError ? <p className="form-error">{quoteError}</p> : null}
          {quote ? (
            <p>
              <strong>{quote.priceLabel}</strong> · {quote.durationMinutes} min on
              site · {quote.bandLabel}
            </p>
          ) : null}
          {!quote && !quoteError && !loadingQuote ? (
            <p className="field-hint">
              Retainers are custom — email{" "}
              <a href={`mailto:${email}`}>{email}</a> instead.
            </p>
          ) : null}
        </div>
      </section>

      <section className="booking-card">
        <h2>2. Property &amp; access</h2>
        <div className="form-grid">
          <label
            className={`field field-span${fieldErrors.propertyAddress ? " is-invalid" : ""}`}
            data-field="propertyAddress"
          >
            <FieldLabel required>Property address</FieldLabel>
            <input
              value={propertyAddress}
              placeholder="123 Rue Example"
              aria-invalid={Boolean(fieldErrors.propertyAddress)}
              aria-describedby={
                fieldErrors.propertyAddress ? "err-propertyAddress" : undefined
              }
              onChange={(event) => {
                setPropertyAddress(event.target.value);
                clearFieldError("propertyAddress");
              }}
              required
            />
            {fieldErrors.propertyAddress ? (
              <span className="field-error" id="err-propertyAddress">
                {fieldErrors.propertyAddress}
              </span>
            ) : null}
          </label>
          <label
            className={`field${fieldErrors.postalCode ? " is-invalid" : ""}`}
            data-field="postalCode"
          >
            <FieldLabel required>Postal code</FieldLabel>
            <input
              value={postalCode}
              placeholder="H2X 1Y4"
              aria-invalid={Boolean(fieldErrors.postalCode)}
              aria-describedby={fieldErrors.postalCode ? "err-postalCode" : undefined}
              onChange={(event) => {
                setPostalCode(event.target.value.toUpperCase());
                clearFieldError("postalCode");
              }}
              required
            />
            {fieldErrors.postalCode ? (
              <span className="field-error" id="err-postalCode">
                {fieldErrors.postalCode}
              </span>
            ) : null}
          </label>
          <label
            className={`field${fieldErrors.city ? " is-invalid" : ""}`}
            data-field="city"
          >
            <FieldLabel required>City</FieldLabel>
            <input
              value={city}
              aria-invalid={Boolean(fieldErrors.city)}
              aria-describedby={fieldErrors.city ? "err-city" : undefined}
              onChange={(event) => {
                setCity(event.target.value);
                clearFieldError("city");
              }}
              required
            />
            {fieldErrors.city ? (
              <span className="field-error" id="err-city">
                {fieldErrors.city}
              </span>
            ) : null}
          </label>
          <label className="field">
            <FieldLabel required>Occupied or vacant</FieldLabel>
            <select
              value={access.occupancy}
              onChange={(event) =>
                setAccess((current) => ({
                  ...current,
                  occupancy: event.target.value as "vacant" | "occupied",
                }))
              }
            >
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
            </select>
          </label>
          <label className="field">
            <FieldLabel required>Access</FieldLabel>
            <select
              value={access.accessType}
              onChange={(event) =>
                setAccess((current) => ({
                  ...current,
                  accessType: event.target.value as typeof access.accessType,
                }))
              }
            >
              <option value="lockbox">Lockbox / code</option>
              <option value="meet">Someone meeting me</option>
              <option value="key">Key pickup</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field field-span">
            <FieldLabel>Access notes (code, lockbox location, alarm)</FieldLabel>
            <input
              value={access.accessNotes}
              onChange={(event) =>
                setAccess((current) => ({
                  ...current,
                  accessNotes: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <FieldLabel>Pets</FieldLabel>
            <input
              value={access.pets}
              onChange={(event) =>
                setAccess((current) => ({ ...current, pets: event.target.value }))
              }
              placeholder="None / dog crated upstairs"
            />
          </label>
          <label className="field">
            <FieldLabel>Parking</FieldLabel>
            <input
              value={access.parkingNotes}
              onChange={(event) =>
                setAccess((current) => ({
                  ...current,
                  parkingNotes: event.target.value,
                }))
              }
              placeholder="Street / driveway"
            />
          </label>
          <label className="field field-span">
            <FieldLabel>Who is meeting (if anyone)</FieldLabel>
            <input
              value={access.meetingContact}
              onChange={(event) =>
                setAccess((current) => ({
                  ...current,
                  meetingContact: event.target.value,
                }))
              }
              placeholder="Name + phone"
            />
          </label>
        </div>
      </section>

      <section
        className={`booking-card${fieldErrors.preferredSlots ? " is-invalid" : ""}`}
        data-field="preferredSlots"
      >
        <h2>
          3. Preferred times{" "}
          <abbr className="required-marker" title="Required">
            *
          </abbr>
        </h2>
        <PreferredTimesPicker
          slots={slots}
          selectedSlots={selectedSlots}
          onChange={(next) => {
            setSelectedSlots(next);
            if (next.length > 0) clearFieldError("preferredSlots");
          }}
          email={email}
          onError={setFormError}
          invalid={Boolean(fieldErrors.preferredSlots)}
          errorMessage={fieldErrors.preferredSlots}
        />
      </section>

      <section className="booking-card">
        <h2>4. Your details</h2>
        <div className="form-grid">
          <label
            className={`field${fieldErrors.agentName ? " is-invalid" : ""}`}
            data-field="agentName"
          >
            <FieldLabel required>Your name</FieldLabel>
            <input
              value={agentName}
              aria-invalid={Boolean(fieldErrors.agentName)}
              aria-describedby={fieldErrors.agentName ? "err-agentName" : undefined}
              onChange={(event) => {
                setAgentName(event.target.value);
                clearFieldError("agentName");
              }}
              required
            />
            {fieldErrors.agentName ? (
              <span className="field-error" id="err-agentName">
                {fieldErrors.agentName}
              </span>
            ) : null}
          </label>
          <label
            className={`field${fieldErrors.agentEmail ? " is-invalid" : ""}`}
            data-field="agentEmail"
          >
            <FieldLabel required>Email</FieldLabel>
            <input
              type="email"
              value={agentEmail}
              aria-invalid={Boolean(fieldErrors.agentEmail)}
              aria-describedby={fieldErrors.agentEmail ? "err-agentEmail" : undefined}
              onChange={(event) => {
                setAgentEmail(event.target.value);
                clearFieldError("agentEmail");
              }}
              required
            />
            {fieldErrors.agentEmail ? (
              <span className="field-error" id="err-agentEmail">
                {fieldErrors.agentEmail}
              </span>
            ) : null}
          </label>
          <label className="field">
            <FieldLabel>Phone</FieldLabel>
            <input
              value={agentPhone}
              onChange={(event) => setAgentPhone(event.target.value)}
            />
          </label>
          <label className="field">
            <FieldLabel>Brokerage</FieldLabel>
            <input
              value={brokerage}
              onChange={(event) => setBrokerage(event.target.value)}
            />
          </label>
          <label className="field field-span">
            <FieldLabel>Anything else</FieldLabel>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Staging notes, priority rooms, soft deadline…"
            />
          </label>
        </div>
      </section>

      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <button className="btn btn-solid" type="submit" disabled={submitting}>
        {submitting ? "Sending request…" : "Request this shoot"}
      </button>
      {triedSubmit && Object.keys(fieldErrors).length > 0 ? (
        <p className="field-hint">
          {Object.keys(fieldErrors).length} required field
          {Object.keys(fieldErrors).length === 1 ? "" : "s"} still need attention.
        </p>
      ) : null}
    </form>
  );
}
