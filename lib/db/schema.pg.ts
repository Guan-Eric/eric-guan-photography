import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Order statuses for the photographer admin board.
 * Flow: requested → confirmed → shot → editing → delivered → paid
 * Confirm is blocked until address, city, price, and shoot time are verified.
 * `cancelled` is allowed until delivery. `delivered` / `paid` are set by
 * Publish / Unlock (or Stripe), not the status dropdown.
 */
export const ORDER_STATUSES = [
  "requested",
  "confirmed",
  "shot",
  "editing",
  "delivered",
  "paid",
  "cancelled",
] as const;

/** Statuses the admin may set via PATCH / dropdown. */
export const MANUAL_ORDER_STATUSES = [
  "requested",
  "confirmed",
  "shot",
  "editing",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ManualOrderStatus = (typeof MANUAL_ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  shot: "Shot",
  editing: "Editing",
  delivered: "Delivered",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export function isManualOrderStatus(status: string): status is ManualOrderStatus {
  return (MANUAL_ORDER_STATUSES as readonly string[]).includes(status);
}

export const GALLERY_STATES = ["proofing", "unlocked", "archived"] as const;
export type GalleryState = (typeof GALLERY_STATES)[number];

export const TRUST_TIERS = ["pay_first", "net7"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export const MEMBERSHIP_ROLES = ["owner", "editor"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const CONNECT_STATUSES = [
  "not_started",
  "pending",
  "complete",
  "restricted",
] as const;
export type ConnectStatus = (typeof CONNECT_STATUSES)[number];

export const PLANS = ["trial", "payg", "starter", "growth", "studio"] as const;
export type PlanId = (typeof PLANS)[number];

/** Plans a studio can buy. `trial` is granted, never purchased. */
export const PURCHASABLE_PLANS = ["payg", "starter", "growth", "studio"] as const;
export type PurchasablePlanId = (typeof PURCHASABLE_PLANS)[number];

export function isPurchasablePlan(value: string): value is PurchasablePlanId {
  return (PURCHASABLE_PLANS as readonly string[]).includes(value);
}

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Photographer / studio operator accounts (platform login). */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * Studio tenants. `configJson` holds the public Tenant shape (theme, packages, etc.).
 * File-based seed for Eric remains the source of truth until edited in-app.
 */
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  domain: text("domain"),
  domainCfId: text("domain_cf_id"),
  domainStatus: text("domain_status"),
  timezone: text("timezone").notNull().default("America/Toronto"),
  configJson: text("config_json").notNull(),
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectStatus: text("stripe_connect_status")
    .$type<ConnectStatus>()
    .notNull()
    .default("not_started"),
  storageBytesUsed: bigint("storage_bytes_used", { mode: "number" })
    .notNull()
    .default(0),
  // BIGINT: quotas are 10GB+ (exceeds Postgres INTEGER max ~2.1GB).
  mediaQuotaBytes: bigint("media_quota_bytes", { mode: "number" })
    .notNull()
    .default(10_737_418_240),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").$type<PlanId>().notNull().default("trial"),
  subscriptionStatus: text("subscription_status")
    .$type<SubscriptionStatus>()
    .notNull()
    .default("trialing"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt: text("trial_ends_at"),
  listingQuotaAnnual: integer("listing_quota_annual").notNull().default(100),
  seatsQuota: integer("seats_quota").notNull().default(1),
  listingsUsedYear: integer("listings_used_year").notNull().default(0),
  listingsYear: integer("listings_year").notNull().default(2026),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const memberships = pgTable("memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  role: text("role").$type<MembershipRole>().notNull().default("owner"),
  createdAt: text("created_at").notNull(),
});

export const uploadRateLimits = pgTable("upload_rate_limits", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  windowStartedAt: text("window_started_at").notNull(),
  uploadCount: integer("upload_count").notNull().default(0),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  status: text("status").$type<OrderStatus>().notNull().default("requested"),

  packageId: text("package_id").notNull(),
  packageName: text("package_name").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("CAD"),
  durationMinutes: integer("duration_minutes").notNull(),
  squareFootage: integer("square_footage").notNull(),

  propertyAddress: text("property_address").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city"),

  preferredStart: text("preferred_start").notNull(),
  preferredEnd: text("preferred_end").notNull(),
  preferredSlotsJson: text("preferred_slots_json").notNull().default("[]"),

  agentName: text("agent_name").notNull(),
  agentEmail: text("agent_email").notNull(),
  agentPhone: text("agent_phone"),
  brokerage: text("brokerage"),

  occupancy: text("occupancy").$type<"vacant" | "occupied">().notNull(),
  accessType: text("access_type")
    .$type<"lockbox" | "meet" | "key" | "other">()
    .notNull(),
  accessNotes: text("access_notes"),
  pets: text("pets"),
  parkingNotes: text("parking_notes"),
  meetingContact: text("meeting_contact"),
  notes: text("notes"),

  placeId: text("place_id"),
  mapLat: text("map_lat"),
  mapLng: text("map_lng"),

  publicToken: text("public_token").notNull(),
  calendarEventId: text("calendar_event_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  bufferMinutes: integer("buffer_minutes").notNull().default(45),
  postalCode: text("postal_code").notNull(),
  onMyWayAt: text("on_my_way_at"),
  arrivedAt: text("arrived_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

/**
 * Per-studio Google Calendar OAuth. Tokens are stored encrypted.
 * `blockExternalEvents` lets the photographer treat non-Studiofront
 * events on the connected calendar as booking blockers.
 */
export const calendarConnections = pgTable("calendar_connections", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  provider: text("provider").notNull().default("google"),
  accountEmail: text("account_email"),
  calendarId: text("calendar_id").notNull().default("primary"),
  calendarName: text("calendar_name"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: text("token_expires_at"),
  blockExternalEvents: integer("block_external_events").notNull().default(0),
  connectedAt: text("connected_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const galleries = pgTable("galleries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  state: text("state").$type<GalleryState>().notNull().default("proofing"),
  publicToken: text("public_token").notNull(),
  brandMode: text("brand_mode").$type<"branded" | "unbranded">().notNull().default("branded"),
  trustTier: text("trust_tier").$type<TrustTier>().notNull().default("pay_first"),
  title: text("title").notNull(),
  propertyAddress: text("property_address").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("CAD"),
  unlockedAt: text("unlocked_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  galleryId: text("gallery_id")
    .notNull()
    .references(() => galleries.id),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  sortOrder: integer("sort_order").notNull().default(0),
  originalName: text("original_name").notNull(),
  roomLabel: text("room_label"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytesOriginal: bigint("bytes_original", { mode: "number" }).notNull(),
  pathOriginal: text("path_original").notNull(),
  pathWeb: text("path_web").notNull(),
  pathProof: text("path_proof").notNull(),
  pathMls: text("path_mls").notNull(),
  createdAt: text("created_at").notNull(),
});

export const MEDIA_LINK_KINDS = ["video", "tour", "floorplan", "doc"] as const;
export type MediaLinkKind = (typeof MEDIA_LINK_KINDS)[number];

export const mediaLinks = pgTable("media_links", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  galleryId: text("gallery_id").references(() => galleries.id),
  listingPageId: text("listing_page_id"),
  kind: text("kind").$type<MediaLinkKind>().notNull(),
  provider: text("provider").notNull().default("link"),
  url: text("url"),
  storagePath: text("storage_path"),
  title: text("title"),
  sortOrder: integer("sort_order").notNull().default(0),
  brandMode: text("brand_mode").$type<"branded" | "unbranded" | "both">().notNull().default("both"),
  createdAt: text("created_at").notNull(),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  galleryId: text("gallery_id")
    .notNull()
    .references(() => galleries.id),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  provider: text("provider").$type<"stripe" | "local_stub">().notNull(),
  providerSessionId: text("provider_session_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("CAD"),
  status: text("status")
    .$type<"pending" | "paid" | "failed" | "cancelled">()
    .notNull()
    .default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type Gallery = typeof galleries.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type MediaLink = typeof mediaLinks.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type User = typeof users.$inferSelect;
export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  type: text("type").notNull(),
  stripeId: text("stripe_id"),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const listingPages = pgTable("listing_pages", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  galleryId: text("gallery_id").references(() => galleries.id),
  slug: text("slug").notNull(),
  brandMode: text("brand_mode").$type<"branded" | "unbranded">().notNull().default("branded"),
  title: text("title").notNull(),
  propertyAddress: text("property_address").notNull(),
  agentName: text("agent_name").notNull(),
  agentEmail: text("agent_email").notNull(),
  agentPhone: text("agent_phone"),
  brokerage: text("brokerage"),
  mapLat: text("map_lat"),
  mapLng: text("map_lng"),
  headline: text("headline"),
  description: text("description"),
  theme: text("theme").notNull().default("gallery"),
  heroAssetId: text("hero_asset_id"),
  sectionsJson: text("sections_json").notNull().default("[]"),
  openHouseJson: text("open_house_json").notNull().default("[]"),
  leadCapture: integer("lead_capture").notNull().default(1),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Per-listing custom hostnames (Cloudflare for SaaS), billed per domain. */
export const listingDomains = pgTable("listing_domains", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  listingPageId: text("listing_page_id")
    .notNull()
    .references(() => listingPages.id),
  hostname: text("hostname").notNull(),
  cfId: text("cf_id"),
  status: text("status").notNull().default("pending"),
  purchasedByEmail: text("purchased_by_email"),
  paidUntil: text("paid_until"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const galleryEvents = pgTable("gallery_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  galleryId: text("gallery_id")
    .notNull()
    .references(() => galleries.id),
  orderId: text("order_id").notNull(),
  kind: text("kind").$type<"view" | "download">().notNull(),
  createdAt: text("created_at").notNull(),
});

export const membershipInvites = pgTable("membership_invites", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  email: text("email").notNull(),
  role: text("role").$type<MembershipRole>().notNull().default("editor"),
  token: text("token").notNull(),
  invitedByUserId: text("invited_by_user_id").notNull(),
  acceptedAt: text("accepted_at"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const reminderSends = pgTable("reminder_sends", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id").notNull(),
  kind: text("kind").notNull(),
  sentAt: text("sent_at").notNull(),
});

export const agentLoginTokens = pgTable("agent_login_tokens", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  createdAt: text("created_at").notNull(),
});

export const referralCodes = pgTable("referral_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  code: text("code").notNull(),
  createdAt: text("created_at").notNull(),
});

export const referralCredits = pgTable("referral_credits", {
  id: text("id").primaryKey(),
  referralCodeId: text("referral_code_id").notNull(),
  referrerUserId: text("referrer_user_id").notNull(),
  newTenantId: text("new_tenant_id").notNull(),
  bonusDays: integer("bonus_days").notNull(),
  createdAt: text("created_at").notNull(),
});

export const reviewRequests = pgTable("review_requests", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id").notNull(),
  agentEmail: text("agent_email").notNull(),
  token: text("token").notNull(),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
});

export const testimonials = pgTable("testimonials", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id"),
  agentName: text("agent_name").notNull(),
  agentEmail: text("agent_email").notNull(),
  body: text("body").notNull(),
  rating: integer("rating").notNull().default(5),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
});

export type TenantRow = typeof tenants.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type ListingPage = typeof listingPages.$inferSelect;
export type ListingDomain = typeof listingDomains.$inferSelect;
export type GalleryEvent = typeof galleryEvents.$inferSelect;
export type MembershipInvite = typeof membershipInvites.$inferSelect;
export type AgentLoginToken = typeof agentLoginTokens.$inferSelect;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type ReferralCredit = typeof referralCredits.$inferSelect;
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
