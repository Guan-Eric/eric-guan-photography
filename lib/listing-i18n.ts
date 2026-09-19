import type {
  AgencyLicenseType,
  BrokerLicenseType,
  ComplianceRegion,
  ListingStatus,
} from "@/lib/db/schema";
import {
  AGENCY_LICENSE_LABELS,
  BROKER_LICENSE_LABELS,
} from "@/lib/listing-compliance";

export type ListingLocale = "en" | "fr";

export function listingLocaleForRegion(region: ComplianceRegion | null | undefined): ListingLocale {
  return region === "ca_qc" ? "fr" : "en";
}

export const listingCopy = {
  en: {
    presentedBy: "Presented by",
    openHouse: "Open house",
    photosPreparing: "Photos for this listing are still being prepared.",
    viewMap: "View on OpenStreetMap",
    photosBy: (name: string) => `Photos by ${name}.`,
    soldNotice: "This property has been sold.",
    pendingNotice: "Sale pending.",
    alterationBanner:
      "Some images on this page have been digitally enhanced, virtually staged, or generated with AI. See captions for details.",
    viewOriginal: "View unaltered original",
    viewAllOriginals: "View all unaltered originals",
    licenseType: "Licence",
    agency: "Agency",
    phone: "Phone",
    langSwitch: "Français",
    langSwitchHref: (slug: string) => `/fr/p/${slug}`,
  },
  fr: {
    presentedBy: "Présenté par",
    openHouse: "Visite libre",
    photosPreparing: "Les photos de cette propriété sont en cours de préparation.",
    viewMap: "Voir sur OpenStreetMap",
    photosBy: (name: string) => `Photos par ${name}.`,
    soldNotice: "Cette propriété a été vendue.",
    pendingNotice: "Vente en cours.",
    alterationBanner:
      "Certaines images de cette page ont été modifiées numériquement, mises en scène virtuellement ou générées par IA. Voir les légendes pour le détail.",
    viewOriginal: "Voir l’original non modifié",
    viewAllOriginals: "Voir tous les originaux non modifiés",
    licenseType: "Permis",
    agency: "Agence",
    phone: "Téléphone",
    langSwitch: "English",
    langSwitchHref: (slug: string) => `/p/${slug}`,
  },
} as const;

export function brokerLicenseLabel(
  type: BrokerLicenseType | null | undefined,
  locale: ListingLocale,
) {
  if (!type) return null;
  return BROKER_LICENSE_LABELS[type]?.[locale] ?? null;
}

export function agencyLicenseLabel(
  type: AgencyLicenseType | null | undefined,
  locale: ListingLocale,
) {
  if (!type) return null;
  return AGENCY_LICENSE_LABELS[type]?.[locale] ?? null;
}

export function statusBanner(status: ListingStatus | null | undefined, locale: ListingLocale) {
  if (status === "sold") return listingCopy[locale].soldNotice;
  if (status === "pending") return listingCopy[locale].pendingNotice;
  return null;
}
