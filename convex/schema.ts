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
  v.literal("qualified"),
  v.literal("refund_eligible"),
  v.literal("refunded"),
  v.literal("moved"),
  v.literal("canceled"),
);

export const paymentType = v.union(
  v.literal("application_fee"),
  v.literal("deposit"),
  v.literal("first_month"),
  v.literal("rent"),
);

export const paymentStatus = v.union(
  v.literal("created"),
  v.literal("checkout_open"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("canceled"),
  v.literal("refunded"),
);

export const refundStatus = v.union(
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
);

export const role = v.union(
  v.literal("renter"),
  v.literal("org_owner"),
  v.literal("leasing_agent"),
  v.literal("platform_admin"),
);

export const leaseStatus = v.union(v.literal("active"), v.literal("ended"));

export const rentChargeStatus = v.union(
  v.literal("due"),
  v.literal("checkout_open"),
  v.literal("paid"),
  v.literal("failed"),
);

export const maintenancePriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const maintenanceStatus = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("resolved"),
);

export const notificationType = v.union(
  v.literal("application_fee_paid"),
  v.literal("approved_for_deposit"),
  v.literal("qualified"),
  v.literal("selected_tenant"),
  v.literal("not_selected"),
  v.literal("refund_completed"),
  v.literal("moved_in"),
  v.literal("denied"),
  v.literal("tenant_selected"),
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
  })
    .index("by_name", ["name"])
    .index("by_stripeConnectAccountId", ["stripeConnectAccountId"]),

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
    depositCents: v.number(),
    firstMonthCents: v.number(),
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
    .index("by_renter_and_listing", ["renterUserId", "listingId"])
    .index("by_listing_and_status", ["listingId", "status"]),

  screeningReports: defineTable({
    applicationId: v.id("applications"),
    vendorRef: v.string(),
    status: v.union(
      v.literal("not_started"),
      v.literal("pending"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    summary: v.optional(v.string()),
    missingDocs: v.array(v.string()),
    requestedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_application", ["applicationId"]),

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
    rentChargeId: v.optional(v.id("rentCharges")),
  })
    .index("by_application", ["applicationId"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_stripeEventId", ["stripeEventId"])
    .index("by_checkoutSession", ["stripeCheckoutSessionId"])
    .index("by_rentCharge", ["rentChargeId"]),

  leases: defineTable({
    applicationId: v.id("applications"),
    listingId: v.id("listings"),
    orgId: v.id("orgs"),
    renterUserId: v.id("users"),
    rentCents: v.number(),
    dueDayOfMonth: v.number(),
    startDate: v.number(),
    status: leaseStatus,
  })
    .index("by_application", ["applicationId"])
    .index("by_renter", ["renterUserId"])
    .index("by_org", ["orgId"]),

  messageThreads: defineTable({
    applicationId: v.id("applications"),
    orgId: v.id("orgs"),
    renterUserId: v.id("users"),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_application", ["applicationId"])
    .index("by_renter", ["renterUserId"])
    .index("by_org", ["orgId"]),

  messages: defineTable({
    threadId: v.id("messageThreads"),
    senderUserId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_thread", ["threadId"]),

  rentCharges: defineTable({
    leaseId: v.id("leases"),
    periodKey: v.string(),
    dueDate: v.number(),
    amountCents: v.number(),
    status: rentChargeStatus,
  })
    .index("by_lease", ["leaseId"])
    .index("by_lease_and_period", ["leaseId", "periodKey"]),

  maintenanceRequests: defineTable({
    leaseId: v.id("leases"),
    orgId: v.id("orgs"),
    renterUserId: v.id("users"),
    title: v.string(),
    description: v.string(),
    priority: maintenancePriority,
    status: maintenanceStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_lease", ["leaseId"])
    .index("by_renter", ["renterUserId"])
    .index("by_org", ["orgId"])
    .index("by_org_and_status", ["orgId", "status"]),

  stripeEvents: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    processedAt: v.number(),
  }).index("by_stripeEventId", ["stripeEventId"]),

  refunds: defineTable({
    applicationId: v.id("applications"),
    paymentId: v.id("payments"),
    amountCents: v.number(),
    status: refundStatus,
    idempotencyKey: v.string(),
    stripeRefundId: v.optional(v.string()),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_application", ["applicationId"])
    .index("by_payment", ["paymentId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  notifications: defineTable({
    userId: v.id("users"),
    applicationId: v.id("applications"),
    orgId: v.optional(v.id("orgs")),
    type: notificationType,
    title: v.string(),
    body: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
    emailSentAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "readAt"])
    .index("by_org", ["orgId"])
    .index("by_application", ["applicationId"]),
});
