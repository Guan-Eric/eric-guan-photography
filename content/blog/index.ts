import type { BlogPost } from "./types";
import { post as aryeoAlternative } from "./aryeo-alternative";
import { post as aryeoAlternativesList } from "./aryeo-alternatives-list";
import { post as aryeoVsStudiofront } from "./aryeo-vs-studiofront";
import { post as bestRealEstatePhotographySoftware } from "./best-real-estate-photography-software";
import { post as customDomainPhotographyStudioWebsite } from "./custom-domain-photography-studio-website";
import { post as deliverListingPhotosWithoutAgentLogin } from "./deliver-listing-photos-without-agent-login";
import { post as getPaidFasterRealEstatePhotographer } from "./get-paid-faster-real-estate-photographer";
import { post as googleDriveListingGalleries } from "./google-drive-listing-galleries";
import { post as hdphotohubAlternative } from "./hdphotohub-alternative";
import { post as hdphotohubVsStudiofront } from "./hdphotohub-vs-studiofront";
import { post as howToPriceRealEstatePhotographyPackages } from "./how-to-price-real-estate-photography-packages";
import { post as multiPhotographerStudioSoftware } from "./multi-photographer-studio-software";
import { post as payToUnlockRealEstateGalleries } from "./pay-to-unlock-real-estate-galleries";
import { post as perListingVsMonthlySoftware } from "./per-listing-vs-monthly-software";
import { post as photographerSoftwareOnboardingChecklist } from "./photographer-software-onboarding-checklist";
import { post as realEstatePhotographyBookingPricingSoftware } from "./real-estate-photography-booking-pricing-software";
import { post as realEstatePhotographyClientPortalAlternatives } from "./real-estate-photography-client-portal-alternatives";
import { post as realEstatePhotographySoftwareCost } from "./real-estate-photography-software-cost";
import { post as replaceDropboxRealEstatePhotos } from "./replace-dropbox-real-estate-photos";
import { post as saasCostSlowSeasonPhotographers } from "./saas-cost-slow-season-photographers";
import { post as spiroAlternative } from "./spiro-alternative";
import { post as spiroVsStudiofront } from "./spiro-vs-studiofront";
import { post as stripeConnectRealEstatePhotographers } from "./stripe-connect-real-estate-photographers";
import { post as switchFromAryeo } from "./switch-from-aryeo";
import { post as watermarkedProofGalleriesRealEstate } from "./watermarked-proof-galleries-real-estate";
import { post as whiteLabelRealEstatePhotographyWebsite } from "./white-label-real-estate-photography-website";

const ALL_POSTS: BlogPost[] = [
  aryeoAlternative,
  aryeoVsStudiofront,
  bestRealEstatePhotographySoftware,
  deliverListingPhotosWithoutAgentLogin,
  realEstatePhotographyBookingPricingSoftware,
  spiroAlternative,
  hdphotohubAlternative,
  spiroVsStudiofront,
  hdphotohubVsStudiofront,
  aryeoAlternativesList,
  switchFromAryeo,
  replaceDropboxRealEstatePhotos,
  googleDriveListingGalleries,
  photographerSoftwareOnboardingChecklist,
  stripeConnectRealEstatePhotographers,
  perListingVsMonthlySoftware,
  realEstatePhotographySoftwareCost,
  saasCostSlowSeasonPhotographers,
  whiteLabelRealEstatePhotographyWebsite,
  payToUnlockRealEstateGalleries,
  watermarkedProofGalleriesRealEstate,
  howToPriceRealEstatePhotographyPackages,
  multiPhotographerStudioSoftware,
  realEstatePhotographyClientPortalAlternatives,
  customDomainPhotographyStudioWebsite,
  getPaidFasterRealEstatePhotographer,
];

function byDateDesc(a: BlogPost, b: BlogPost) {
  return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
}

export const blogPosts: BlogPost[] = [...ALL_POSTS].sort(byDateDesc);

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug) ?? null;
}

export function getBlogSlugs() {
  return blogPosts.map((post) => post.slug);
}

export type { BlogPost, BlogCta } from "./types";
export { postPath } from "./types";
