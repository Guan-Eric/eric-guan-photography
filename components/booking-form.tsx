"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { PreferredTimesPicker } from "@/components/preferred-times-picker";
import { CoachTour, type CoachStep } from "@/components/coach-tour";
import { addOnsForPackage } from "@/lib/addons";
import type { PreferredSlot } from "@/lib/preferred-slots";
import { isInServiceArea, normalizePostalCode, serviceAreaMessage } from "@/lib/service-area";
import { isBookablePackage } from "@/lib/quoting";
import { toastError, toastSuccess } from "@/lib/toast";
import type { Package, ServiceAreaGate, Tenant } from "@/lib/tenant-schema";

type Slot = { start: string; end: string; label: string };

type QuoteAddOn = { id: string; name: string; priceCents: number };

type QuoteOk = {
  ok: true;
  packageId: string;
  packageName: string;
  priceCents: number;
  basePriceCents: number;
  priceLabel: string;
  currency: string;
  durationMinutes: number;
  squareFootage: number;
  bandLabel: string;
  quoteLater?: boolean;
  addOns: QuoteAddOn[];
};

type Props = {
  packages: Package[];
  defaultPackageId?: string;
  email: string;
  defaultCity?: string;
  timeZone?: string;
  serviceAreaGate?: ServiceAreaGate | null;
  serviceAreaMessage?: string;
  children?: React.ReactNode;
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

type BookingStep = "service" | "details";

const AGENT_BOOK_SERVICE_TOUR: CoachStep[] = [
  {
    selector: '[data-tour="book-package"]',
    title: "Choose a service",
    body: "Browse every package with pricing and what’s included, then continue to booking details.",
  },
];

const AGENT_BOOK_DETAILS_TOUR: CoachStep[] = [
  {
    selector: '[data-tour="book-size"]',
    title: "Property size",
    body: "Enter square footage so the quote updates for the service you picked.",
  },
  {
    selector: '[data-tour="book-addons"]',
    title: "Optional add-ons",
    body: "Add floor plans, rush delivery, or other extras that apply to this package.",
  },
  {
    selector: '[data-tour="book-property"]',
    title: "Property details",
    body: "Add the full address and postal/ZIP so the photographer can find the listing.",
  },
  {
    selector: '[data-tour="book-times"]',
    title: "Preferred times",
    body: "Select one to three start times that work. The photographer confirms one.",
  },
  {
    selector: '[data-tour="book-contact"]',
    title: "Your contact",
    body: "Name and email are required so you get confirmation and the gallery link.",
  },
  {
    selector: '[data-tour="book-submit"]',
    title: "Send the request",
    body: "Submit when ready. You’ll get an email; no payment until photos are delivered.",
  },
];

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
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

function QuoteSummary({
  quote,
  loadingQuote,
  quoteError,
  email,
  submitting,
  includes,
}: {
  quote: QuoteOk | null;
  loadingQuote: boolean;
  quoteError: string | null;
  email: string;
  submitting: boolean;
  includes: string[];
}) {
  return (
    <aside className="booking-quote" aria-live="polite" data-tour="book-quote">
      <h2>Shoot Summary</h2>
      {loadingQuote ? <p className="muted">Calculating quote…</p> : null}
      {quoteError ? <p className="form-error">{quoteError}</p> : null}
      {quote ? (
        <>
          <ul className="booking-quote-rows">
            <li>
              <span>{quote.packageName}</span>
              <span>
                {quote.quoteLater
                  ? "Quote after request"
                  : formatMoney(quote.basePriceCents, quote.currency)}
              </span>
            </li>
            {(quote.addOns ?? []).map((addon) => (
              <li key={addon.id}>
                <span>{addon.name}</span>
                <span>{formatMoney(addon.priceCents, quote.currency)}</span>
              </li>
            ))}
            <li>
              <span>{quote.bandLabel}</span>
              <span>{quote.squareFootage.toLocaleString("en-CA")} sq ft</span>
            </li>
            <li>
              <span>On site</span>
              <span>{quote.durationMinutes} min</span>
            </li>
          </ul>
          {includes.length > 0 ? (
            <ul className="booking-includes">
              {includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <p className="booking-quote-total">
            <span>Total Quote</span>
            <span className="booking-quote-price">{quote.priceLabel}</span>
          </p>
          <p className="field-hint">
            No credit card charged today. Gallery payment required upon delivery of
            previews.
          </p>
        </>
      ) : null}
      {!quote && !quoteError && !loadingQuote ? (
        <p className="field-hint">
          Retainers are custom — email{" "}
          <a href={`mailto:${email}`}>{email}</a> instead.
        </p>
      ) : null}
      <button
        className={`btn btn-solid booking-quote-submit${submitting ? " is-busy" : ""}`}
        type="submit"
        disabled={submitting}
        data-tour="book-submit"
      >
        {submitting ? "Sending request…" : "Send request"}
      </button>
    </aside>
  );
}

export function BookingForm({
  packages,
  defaultPackageId,
  email,
  defaultCity = "",
  timeZone = "America/Toronto",
  serviceAreaGate,
  serviceAreaMessage: serviceAreaMessageProp,
  children,
}: Props) {
  const router = useRouter();
  const bookable = useMemo(
    () => packages.filter(isBookablePackage),
    [packages],
  );

  const deepLinkedPackageId =
    defaultPackageId && bookable.some((pkg) => pkg.id === defaultPackageId)
      ? defaultPackageId
      : "";

  const [step, setStep] = useState<BookingStep>(
    deepLinkedPackageId ? "details" : "service",
  );
  const [packageId, setPackageId] = useState(deepLinkedPackageId);
  const selectedPackage = bookable.find((pkg) => pkg.id === packageId);
  const availableAddOns = useMemo(
    () => (packageId ? addOnsForPackage(packages, packageId) : []),
    [packages, packageId],
  );
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
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
  const [showAccessDetails, setShowAccessDetails] = useState(false);

  const [propertyAddress, setPropertyAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [placeId, setPlaceId] = useState("");
  const [mapLat, setMapLat] = useState("");
  const [mapLng, setMapLng] = useState("");
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
    const areaMessage =
      serviceAreaMessageProp ??
      serviceAreaMessage({ serviceAreaGate } as Tenant);
    if (normalizePostalCode(postalCode).length < 3) {
      errors.postalCode = "Enter a postal or ZIP code.";
    } else if (
      !isInServiceArea(postalCode, { serviceAreaGate } as Tenant)
    ) {
      errors.postalCode = areaMessage;
      errors.propertyAddress = areaMessage;
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
    setAddOnIds((current) =>
      current.filter((id) => availableAddOns.some((addon) => addon.id === id)),
    );
  }, [availableAddOns]);

  useEffect(() => {
    if (!packageId || !squareFootage) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSelectedSlots([]);
      clearFieldError("preferredSlots");

      try {
        const payload = {
          packageId,
          squareFootage: Number(squareFootage),
        };
        const slotsRes = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const slotsJson = await slotsRes.json();
        setSlots(slotsJson.ok ? slotsJson.slots : []);
        if (!slotsJson.ok) {
          setQuoteError(slotsJson.error ?? null);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [packageId, squareFootage]);

  useEffect(() => {
    if (!packageId || !squareFootage) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingQuote(true);
      setQuoteError(null);

      try {
        const payload = {
          packageId,
          squareFootage: Number(squareFootage),
          addOnIds,
        };

        const quoteRes = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const quoteJson = await quoteRes.json();

        if (!quoteJson.ok) {
          setQuote(null);
          setQuoteError(quoteJson.error ?? "Could not quote this package.");
          return;
        }

        setQuote(quoteJson);
        clearFieldError("squareFootage");
        clearFieldError("packageId");
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
  }, [packageId, squareFootage, addOnIds]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step !== "details") return;
    setTriedSubmit(true);
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const areaBlocked =
        Boolean(errors.postalCode) &&
        errors.postalCode === errors.propertyAddress;
      const message = areaBlocked
        ? errors.postalCode!
        : "Check the highlighted fields.";
      setFormError(message);
      toastError(message);
      const firstKey = areaBlocked ? "propertyAddress" : Object.keys(errors)[0];
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
          addOnIds,
          propertyAddress,
          postalCode: normalizePostalCode(postalCode),
          city,
          placeId: placeId || undefined,
          mapLat: mapLat || undefined,
          mapLng: mapLng || undefined,
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
        toastError(message);
        if (/postal|ZIP|cover|service area|Montréal|Montreal/i.test(message)) {
          setFieldErrors({ postalCode: message, propertyAddress: message });
          document
            .querySelector('[data-field="propertyAddress"]')
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (/time|slot|preferred/i.test(message)) {
          setFieldErrors({ preferredSlots: message });
        }
        return;
      }

      toastSuccess("Request sent.");
      router.push(
        `/book/confirmation/${json.orderId}?token=${encodeURIComponent(json.publicToken)}${
          json.emailStubbed ? "&local=1" : ""
        }`,
      );
    } catch {
      setFormError("Network error — try again in a moment.");
      toastError("Network error — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  function continueToDetails() {
    if (!packageId) {
      setFieldErrors({ packageId: "Choose a service to continue." });
      return;
    }
    clearFieldError("packageId");
    setStep("details");
    window.requestAnimationFrame(() => {
      document
        .querySelector('[data-tour="book-selected-package"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (step === "service") {
    return (
      <form
        className="booking-form booking-form--service"
        onSubmit={(event) => {
          event.preventDefault();
          continueToDetails();
        }}
        noValidate
      >
        <div className="booking-form-main">
          {children}
          <div className="booking-panel">
            <section
              className={`booking-step${fieldErrors.packageId ? " is-invalid" : ""}`}
              data-tour="book-package"
              data-field="packageId"
            >
              <h2>1. Choose a service</h2>
              <p className="field-hint booking-service-intro">
                Pick the package that fits the listing. You&rsquo;ll enter address,
                times, and contact next.
              </p>
              {bookable.length === 0 ? (
                <p className="form-error" role="alert">
                  No online packages are available. Email{" "}
                  <a href={`mailto:${email}`}>{email}</a> to book.
                </p>
              ) : (
                <div
                  className="booking-service-grid"
                  role="radiogroup"
                  aria-label="Services"
                  aria-invalid={Boolean(fieldErrors.packageId)}
                  aria-describedby={
                    fieldErrors.packageId ? "err-packageId" : undefined
                  }
                >
                  {bookable.map((pkg) => {
                    const selected = packageId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`booking-service-card${
                          selected ? " is-selected" : ""
                        }${pkg.featured ? " is-featured" : ""}`}
                        data-package-id={pkg.id}
                        onClick={() => {
                          setPackageId(pkg.id);
                          clearFieldError("packageId");
                        }}
                      >
                        <div className="booking-service-card-top">
                          <h3>{pkg.name}</h3>
                          <p className="price">{pkg.price}</p>
                        </div>
                        {pkg.summary ? (
                          <p className="booking-service-summary">{pkg.summary}</p>
                        ) : null}
                        {pkg.includes.length ? (
                          <ul
                            className="package-includes"
                            aria-label={`${pkg.name} includes`}
                          >
                            {pkg.includes.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              {fieldErrors.packageId ? (
                <span className="field-error" id="err-packageId">
                  {fieldErrors.packageId}
                </span>
              ) : null}
              <div className="booking-service-actions">
                <button
                  type="submit"
                  className="btn btn-solid"
                  disabled={!packageId || bookable.length === 0}
                  data-tour="book-continue"
                >
                  Continue
                </button>
              </div>
            </section>
          </div>
        </div>
        <CoachTour tourId="agent_book_v1" steps={AGENT_BOOK_SERVICE_TOUR} />
      </form>
    );
  }

  return (
    <form className="booking-form" onSubmit={onSubmit} noValidate>
      <div className="booking-form-main">
        {children}
        <p className="field-hint form-legend">
          Fields marked <abbr className="required-marker" title="Required">*</abbr> are
          required.
        </p>

        <div
          className="booking-selected-package"
          data-tour="book-selected-package"
        >
          <div className="booking-selected-package-copy">
            <p className="eyebrow">Selected service</p>
            <p className="booking-selected-package-name">
              {selectedPackage?.name ?? "Service"}
              {selectedPackage?.price ? (
                <span className="booking-selected-package-price">
                  {" "}
                  · {selectedPackage.price}
                </span>
              ) : null}
            </p>
            {selectedPackage?.summary ? (
              <p className="field-hint">{selectedPackage.summary}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setStep("service")}
          >
            Change
          </button>
        </div>

        <div className="booking-panel">
      <section className="booking-step" data-tour="book-size">
        <h2>1. Property size</h2>
        <div className="form-grid">
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
        {selectedPackage?.includes.length ? (
          <ul className="booking-includes" aria-label={`${selectedPackage.name} includes`}>
            {selectedPackage.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {availableAddOns.length > 0 ? (
        <section className="booking-step" data-tour="book-addons">
          <h2>2. Add-ons</h2>
          <p className="field-hint">Optional extras for this package.</p>
          <div className="booking-addon-list">
            {availableAddOns.map((addon) => {
              const checked = addOnIds.includes(addon.id);
              return (
                <label key={addon.id} className="booking-addon-option field field-check">
                  <span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setAddOnIds((current) =>
                          event.target.checked
                            ? [...current, addon.id]
                            : current.filter((id) => id !== addon.id),
                        );
                      }}
                    />{" "}
                    <strong>{addon.name}</strong>
                    {addon.price ? (
                      <span className="muted"> · {addon.price}</span>
                    ) : null}
                  </span>
                  {addon.summary ? (
                    <span className="field-hint booking-addon-summary">{addon.summary}</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      <section
        className={`booking-step${
          fieldErrors.propertyAddress || fieldErrors.postalCode ? " is-invalid" : ""
        }`}
        data-tour="book-property"
      >
        <h2>{availableAddOns.length > 0 ? "3" : "2"}. Property</h2>
        <div className="form-grid">
          <label
            className={`field field-span${fieldErrors.propertyAddress ? " is-invalid" : ""}`}
            data-field="propertyAddress"
          >
            <FieldLabel required>Property address</FieldLabel>
            <AddressAutocomplete
              value={propertyAddress}
              invalid={Boolean(fieldErrors.propertyAddress)}
              describedBy={
                fieldErrors.propertyAddress ? "err-propertyAddress" : undefined
              }
              required
              onChange={(next) => {
                setPropertyAddress(next);
                setPlaceId("");
                clearFieldError("propertyAddress");
              }}
              onResolved={(address) => {
                setPropertyAddress(address.line1 || address.formatted);
                setCity(address.city || city);
                setPostalCode(address.postalCode);
                setPlaceId(address.placeId);
                setMapLat(address.lat);
                setMapLng(address.lng);
                const areaMessage =
                  serviceAreaMessageProp ??
                  serviceAreaMessage({ serviceAreaGate } as Tenant);
                const outOfArea = Boolean(
                  address.postalCode &&
                    !isInServiceArea(address.postalCode, {
                      serviceAreaGate,
                    } as Tenant),
                );
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.city;
                  if (outOfArea) {
                    next.propertyAddress = areaMessage;
                    next.postalCode = areaMessage;
                  } else {
                    delete next.propertyAddress;
                    delete next.postalCode;
                  }
                  return next;
                });
              }}
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
            <FieldLabel required>Postal / ZIP</FieldLabel>
            <input
              value={postalCode}
              placeholder="H2X 1Y4"
              aria-invalid={Boolean(fieldErrors.postalCode)}
              aria-describedby={fieldErrors.postalCode ? "err-postalCode" : undefined}
              onChange={(event) => {
                setPostalCode(event.target.value.toUpperCase());
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.postalCode;
                  const area =
                    serviceAreaMessageProp ??
                    serviceAreaMessage({ serviceAreaGate } as Tenant);
                  if (next.propertyAddress === area) {
                    delete next.propertyAddress;
                  }
                  return next;
                });
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
        </div>

        <button
          type="button"
          className="btn btn-outline booking-access-toggle"
          aria-expanded={showAccessDetails}
          onClick={() => setShowAccessDetails((open) => !open)}
        >
          {showAccessDetails ? "Hide access details" : "Add access details"}
        </button>

        {showAccessDetails ? (
          <div className="form-grid booking-access-grid">
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
        ) : (
          <p className="field-hint">
            Optional for now — occupancy defaults to vacant with lockbox access.
          </p>
        )}
      </section>

      <section
        className={`booking-step${fieldErrors.preferredSlots ? " is-invalid" : ""}`}
        data-field="preferredSlots"
        data-tour="book-times"
      >
        <h2>
          {availableAddOns.length > 0 ? "4" : "3"}. Preferred times{" "}
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
          timeZone={timeZone}
          onError={setFormError}
          invalid={Boolean(fieldErrors.preferredSlots)}
          errorMessage={fieldErrors.preferredSlots}
        />
      </section>

      <section className="booking-step" data-tour="book-contact">
        <h2>{availableAddOns.length > 0 ? "5" : "4"}. Your details</h2>
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
      </div>

      <div className="booking-form-actions">
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          className={`btn btn-solid${submitting ? " is-busy" : ""}`}
          type="submit"
          disabled={submitting}
          data-tour="book-submit"
        >
          {submitting ? "Sending request…" : "Send request"}
        </button>
        {triedSubmit &&
        Object.keys(fieldErrors).length > 0 &&
        fieldErrors.postalCode !== fieldErrors.propertyAddress ? (
          <p className="field-hint">
            {Object.keys(fieldErrors).length} required field
            {Object.keys(fieldErrors).length === 1 ? "" : "s"} still need attention.
          </p>
        ) : null}
      </div>
      </div>

      <QuoteSummary
        quote={quote}
        loadingQuote={loadingQuote}
        quoteError={quoteError}
        email={email}
        submitting={submitting}
        includes={selectedPackage?.includes ?? []}
      />
      <CoachTour tourId="agent_book_v1" steps={AGENT_BOOK_DETAILS_TOUR} />
    </form>
  );
}
