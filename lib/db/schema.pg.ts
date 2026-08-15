import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Order statuses for the photographer admin board.
 * Flow: requested → confirmed → shot → editing → delivered → paid
 * `cancelled` is a terminal escape hatch from any pre-delivery state.
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

export type OrderStatus = (typeof ORDER_STATUSES)[number];

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

export const PLANS = ["trial", "starter", "growth", "studio"] as const;
export type PlanId = (typeof PLANS)[number];

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

  publicToken: text("public_token").notNull(),
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
  createdAt: text("created_at").notNull(),
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
export type Gallery = typeof galleries.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
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
  publishedAt: text("published_at"),
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

export type TenantRow = typeof tenants.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type ListingPage = typeof listingPages.$inferSelect;
export type GalleryEvent = typeof galleryEvents.$inferSelect;
export type MembershipInvite = typeof membershipInvites.$inferSelect;
