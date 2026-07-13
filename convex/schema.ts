import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const applicationStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("fee_pending"),
  v.literal("fee_paid"),
  v.literal("fee_failed"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("deposit_due"),
  v.literal("deposit_paid"),
  v.literal("first_month_due"),
  v.literal("first_month_paid"),
  v.literal("move_in_ready"),
  v.literal("canceled"),
);

export const paymentType = v.union(
  v.literal("application_fee"),
  v.literal("deposit"),
  v.literal("first_month"),
);

export const paymentStatus = v.union(
  v.literal("created"),
  v.literal("checkout_open"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("canceled"),
);

export const role = v.union(
  v.literal("renter"),
  v.literal("org_owner"),
  v.literal("leasing_agent"),
  v.literal("platform_admin"),
);

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    roles: v.array(role),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  orgs: defineTable({
    name: v.string(),
    stripeConnectAccountId: v.optional(v.string()),
    connectReady: v.boolean(),
  }).index("by_name", ["name"]),

  orgMembers: defineTable({
    orgId: v.id("orgs"),
    userId: v.id("users"),
    role: v.union(v.literal("org_owner"), v.literal("leasing_agent")),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_and_user", ["orgId", "userId"]),

  listings: defineTable({
    orgId: v.id("orgs"),
    title: v.string(),
    description: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    rentCents: v.number(),
    beds: v.number(),
    baths: v.number(),
    photoUrls: v.array(v.string()),
    published: v.boolean(),
    applicationFeeCents: v.number(),
  })
    .index("by_published", ["published"])
    .index("by_org", ["orgId"])
    .index("by_city_published", ["city", "published"]),

  applications: defineTable({
    listingId: v.id("listings"),
    renterUserId: v.id("users"),
    status: applicationStatus,
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    message: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
  })
    .index("by_renter", ["renterUserId"])
    .index("by_listing", ["listingId"])
    .index("by_renter_and_listing", ["renterUserId", "listingId"]),

  payments: defineTable({
    applicationId: v.id("applications"),
    type: paymentType,
    status: paymentStatus,
    amountCents: v.number(),
    currency: v.literal("usd"),
    idempotencyKey: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeEventId: v.optional(v.string()),
  })
    .index("by_application", ["applicationId"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_stripeEventId", ["stripeEventId"])
    .index("by_checkoutSession", ["stripeCheckoutSessionId"]),

  stripeEvents: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    processedAt: v.number(),
  }).index("by_stripeEventId", ["stripeEventId"]),
});
