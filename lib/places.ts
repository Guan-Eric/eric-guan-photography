export type PlaceSuggestion = {
  placeId: string;
  primary: string;
  secondary: string;
};

export type ResolvedAddress = {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lat: string;
  lng: string;
  placeId: string;
  formatted: string;
};

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function component(
  parts: AddressComponent[],
  type: string,
  prefer: "long" | "short" = "long",
) {
  const hit = parts.find((part) => part.types?.includes(type));
  if (!hit) return "";
  return (prefer === "short" ? hit.shortText : hit.longText) ?? hit.longText ?? "";
}

/** Map Google Places (New) addressComponents into booking form fields. */
export function parseAddressComponents(
  parts: AddressComponent[],
  extras?: { placeId?: string; formatted?: string; lat?: number; lng?: number },
): ResolvedAddress {
  const streetNumber = component(parts, "street_number");
  const route = component(parts, "route");
  const premise = component(parts, "premise") || component(parts, "subpremise");
  const line1 = [streetNumber, route].filter(Boolean).join(" ") || premise;

  const city =
    component(parts, "locality") ||
    component(parts, "postal_town") ||
    component(parts, "sublocality") ||
    component(parts, "administrative_area_level_2");

  return {
    line1: line1.trim(),
    city: city.trim(),
    region: component(parts, "administrative_area_level_1", "short").trim(),
    postalCode: component(parts, "postal_code").replace(/\s+/g, " ").trim().toUpperCase(),
    country: component(parts, "country", "short").trim(),
    lat: extras?.lat != null ? String(extras.lat) : "",
    lng: extras?.lng != null ? String(extras.lng) : "",
    placeId: extras?.placeId ?? "",
    formatted: extras?.formatted ?? line1,
  };
}

export function placesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
}

export function regionCodesForGate(region: "CA" | "US" | "none" | undefined) {
  if (region === "CA") return ["CA"];
  if (region === "US") return ["US"];
  return [] as string[];
}

export function newPlacesSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
