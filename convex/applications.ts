import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalQuery, mutation, query } from "./_generated/server";
import {
  requireOrgMember,
  requireOrgRole,
  requireUser,
} from "./lib/auth";
import { ensureLeaseFromApplication } from "./leases";
import {
  notifyApprovedForDeposit,
  notifyDenied,
  notifyMovedIn,
  notifyNotSelected,
  notifySelectedTenant,
} from "./lib/notificationHelpers";
import { applicationStatus } from "./schema";

export const getMine = query({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.object({
      _id: v.id("applications"),
      listingId: v.id("listings"),
      status: applicationStatus,
      fullName: v.string(),
      email: v.string(),
      phone: v.string(),
      message: v.optional(v.string()),
      submittedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return null;
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.renterUserId !== user._id) return null;
    return {
      _id: application._id,
      listingId: application.listingId,
      status: application.status,
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      message: application.message,
      submittedAt: application.submittedAt,
    };
  },
});

const renterApplicationSummary = v.object({
  _id: v.id("applications"),
  listingId: v.id("listings"),
  listingTitle: v.string(),
  listingCity: v.string(),
  listingState: v.string(),
  status: applicationStatus,
  submittedAt: v.optional(v.number()),
});

export const listMine = query({
  args: {},
  returns: v.array(renterApplicationSummary),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_renter", (q) => q.eq("renterUserId", user._id))
      .collect();

    const summaries = [];
    for (const application of applications) {
      const listing = await ctx.db.get(application.listingId);
      if (!listing) continue;
      summaries.push({
        _id: application._id,
        listingId: application.listingId,
        listingTitle: listing.title,
        listingCity: listing.city,
        listingState: listing.state,
        status: application.status,
        submittedAt: application.submittedAt,
      });
    }

    summaries.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
    return summaries;
  },
});

export const createDraft = mutation({
  args: {
    listingId: v.id("listings"),
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.id("applications"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing || !listing.published) {
      throw new Error("Listing not found");
    }

    await assertListingAcceptsApplications(ctx, args.listingId);

    const ownOrgMembership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", listing.orgId).eq("userId", user._id),
      )
      .unique();
    if (ownOrgMembership) {
      throw new Error(
        "You cannot apply to a listing owned by your organization",
      );
    }

    const existing = await ctx.db
      .query("applications")
      .withIndex("by_renter_and_listing", (q) =>
        q.eq("renterUserId", user._id).eq("listingId", args.listingId),
      )
      .first();
    if (existing && existing.status !== "canceled") {
      return existing._id;
    }
    return await ctx.db.insert("applications", {
      listingId: args.listingId,
      renterUserId: user._id,
      status: "draft",
      fullName: args.fullName,
      email: args.email,
      phone: args.phone,
      message: args.message,
    });
  },
});

export const submit = mutation({
  args: { applicationId: v.id("applications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.renterUserId !== user._id) {
      throw new Error("Application not found");
    }
    if (application.status !== "draft") {
      throw new Error("Only draft applications can be submitted");
    }

    const listing = await ctx.db.get(application.listingId);
    if (!listing) throw new Error("Listing not found");
    await assertListingAcceptsApplications(ctx, application.listingId);
    const ownOrgMembership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", listing.orgId).eq("userId", user._id),
      )
      .unique();
    if (ownOrgMembership) {
      throw new Error(
        "You cannot apply to a listing owned by your organization",
      );
    }

    await ctx.db.patch(args.applicationId, {
      status: "submitted",
      submittedAt: Date.now(),
    });
    return null;
  },
});

export const getScreeningContext = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.object({
      fullName: v.string(),
      email: v.string(),
      phone: v.string(),
      status: applicationStatus,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) return null;
    return {
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      status: application.status,
    };
  },
});

const inboxApplication = v.object({
  _id: v.id("applications"),
  listingId: v.id("listings"),
  listingTitle: v.string(),
  status: applicationStatus,
  fullName: v.string(),
  email: v.string(),
  submittedAt: v.optional(v.number()),
});

const paymentSummary = v.object({
  feePaid: v.boolean(),
  depositPaid: v.boolean(),
  firstMonthPaid: v.boolean(),
});

const orgApplicationSummary = v.object({
  _id: v.id("applications"),
  listingId: v.id("listings"),
  listingTitle: v.string(),
  status: applicationStatus,
  fullName: v.string(),
  email: v.string(),
  submittedAt: v.optional(v.number()),
  payments: paymentSummary,
});

const applicationReview = v.object({
  _id: v.id("applications"),
  listingId: v.id("listings"),
  status: applicationStatus,
  fullName: v.string(),
  email: v.string(),
  phone: v.string(),
  message: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  payments: paymentSummary,
  qualifiedCountOnListing: v.number(),
  listing: v.object({
    title: v.string(),
    city: v.string(),
    state: v.string(),
  }),
});

const INBOX_STATUSES = new Set([
  "under_review",
  "fee_paid",
] as const);

async function requireApplicationInOrg(
  ctx: Parameters<typeof requireUser>[0],
  orgId: Id<"orgs">,
  applicationId: Id<"applications">,
) {
  const application = await ctx.db.get(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }
  const listing = await ctx.db.get(application.listingId);
  if (!listing || listing.orgId !== orgId) {
    throw new Error("Application not found");
  }
  return { application, listing };
}

async function paymentSummaryForApplication(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  applicationId: Id<"applications">,
) {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .collect();

  return {
    feePaid: payments.some(
      (p) => p.type === "application_fee" && p.status === "succeeded",
    ),
    depositPaid: payments.some(
      (p) => p.type === "deposit" && p.status === "succeeded",
    ),
    firstMonthPaid: payments.some(
      (p) => p.type === "first_month" && p.status === "succeeded",
    ),
  };
}

async function countQualifiedOnListing(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  listingId: Id<"listings">,
) {
  const applications = await ctx.db
    .query("applications")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();
  return applications.filter((a) => a.status === "qualified").length;
}

async function listingHasActiveTenant(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  listingId: Id<"listings">,
) {
  const applications = await ctx.db
    .query("applications")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();
  return applications.some(
    (a) => a.status === "move_in_ready" || a.status === "moved",
  );
}

async function assertListingAcceptsApplications(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  listingId: Id<"listings">,
) {
  const listing = await ctx.db.get(listingId);
  if (!listing || !listing.published) {
    throw new Error("This listing is not accepting applications");
  }
  if (await listingHasActiveTenant(ctx, listingId)) {
    throw new Error("This listing already has a selected tenant");
  }
}

const LANDLORD_VISIBLE_STATUSES = new Set([
  "submitted",
  "fee_pending",
  "fee_paid",
  "fee_failed",
  "under_review",
  "approved",
  "denied",
  "deposit_due",
  "deposit_paid",
  "first_month_due",
  "first_month_paid",
  "qualified",
  "move_in_ready",
  "refund_eligible",
  "refunded",
  "moved",
]);

export const listAllForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(orgApplicationSummary),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const results = [];
    for (const listing of listings) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
        .collect();

      for (const application of applications) {
        if (
          application.status === "draft" ||
          application.status === "canceled" ||
          !LANDLORD_VISIBLE_STATUSES.has(application.status)
        ) {
          continue;
        }
        results.push({
          _id: application._id,
          listingId: application.listingId,
          listingTitle: listing.title,
          status: application.status,
          fullName: application.fullName,
          email: application.email,
          submittedAt: application.submittedAt,
          payments: await paymentSummaryForApplication(ctx, application._id),
        });
      }
    }

    results.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
    return results;
  },
});

export const getOrgStats = query({
  args: { orgId: v.id("orgs") },
  returns: v.object({
    total: v.number(),
    needsReview: v.number(),
    qualified: v.number(),
    moveInReady: v.number(),
    refundEligible: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    let total = 0;
    let needsReview = 0;
    let qualified = 0;
    let moveInReady = 0;
    let refundEligible = 0;

    for (const listing of listings) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
        .collect();

      for (const application of applications) {
        if (
          application.status === "draft" ||
          application.status === "canceled"
        ) {
          continue;
        }
        total += 1;
        if (
          application.status === "under_review" ||
          application.status === "fee_paid"
        ) {
          needsReview += 1;
        }
        if (application.status === "qualified") qualified += 1;
        if (application.status === "move_in_ready") moveInReady += 1;
        if (application.status === "refund_eligible") refundEligible += 1;
      }
    }

    return { total, needsReview, qualified, moveInReady, refundEligible };
  },
});

export const listInboxForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(inboxApplication),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const inbox = [];
    for (const listing of listings) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_listing_and_status", (q) => q.eq("listingId", listing._id))
        .collect();
      for (const application of applications) {
        if (!INBOX_STATUSES.has(application.status as "under_review" | "fee_paid")) {
          continue;
        }
        inbox.push({
          _id: application._id,
          listingId: application.listingId,
          listingTitle: listing.title,
          status: application.status,
          fullName: application.fullName,
          email: application.email,
          submittedAt: application.submittedAt,
        });
      }
    }

    inbox.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
    return inbox;
  },
});

export const getForOrgReview = query({
  args: { orgId: v.id("orgs"), applicationId: v.id("applications") },
  returns: v.union(applicationReview, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    try {
      await requireOrgMember(ctx, user, args.orgId);
    } catch {
      return null;
    }
    const application = await ctx.db.get(args.applicationId);
    if (!application) return null;
    const listing = await ctx.db.get(application.listingId);
    if (!listing || listing.orgId !== args.orgId) return null;
    return {
      _id: application._id,
      listingId: application.listingId,
      status: application.status,
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      message: application.message,
      submittedAt: application.submittedAt,
      payments: await paymentSummaryForApplication(ctx, application._id),
      qualifiedCountOnListing: await countQualifiedOnListing(
        ctx,
        application.listingId,
      ),
      listing: {
        title: listing.title,
        city: listing.city,
        state: listing.state,
      },
    };
  },
});

export const approve = mutation({
  args: { orgId: v.id("orgs"), applicationId: v.id("applications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, [
      "org_owner",
      "leasing_agent",
    ]);
    const { application } = await requireApplicationInOrg(
      ctx,
      args.orgId,
      args.applicationId,
    );
    if (application.status !== "under_review" && application.status !== "fee_paid") {
      throw new Error("Only applications under review can be approved");
    }
    await ctx.db.patch(args.applicationId, { status: "deposit_due" });
    await notifyApprovedForDeposit(ctx, args.applicationId);
    return null;
  },
});

export const deny = mutation({
  args: {
    orgId: v.id("orgs"),
    applicationId: v.id("applications"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, [
      "org_owner",
      "leasing_agent",
    ]);
    const { application } = await requireApplicationInOrg(
      ctx,
      args.orgId,
      args.applicationId,
    );
    if (application.status !== "under_review" && application.status !== "fee_paid") {
      throw new Error("Only applications under review can be denied");
    }
    void args.reason;
    await ctx.db.patch(args.applicationId, { status: "denied" });
    await notifyDenied(ctx, args.applicationId);
    return null;
  },
});

export const selectApplicant = mutation({
  args: { orgId: v.id("orgs"), applicationId: v.id("applications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, [
      "org_owner",
      "leasing_agent",
    ]);

    const { application, listing } = await requireApplicationInOrg(
      ctx,
      args.orgId,
      args.applicationId,
    );

    if (application.status !== "qualified") {
      throw new Error(
        "Only fully qualified applicants (deposit and first month paid) can be selected",
      );
    }

    if (await listingHasActiveTenant(ctx, listing._id)) {
      throw new Error("This listing already has a selected tenant");
    }

    const siblings = await ctx.db
      .query("applications")
      .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
      .collect();

    const refundEligibleIds: Array<Id<"applications">> = [];

    for (const sibling of siblings) {
      if (sibling._id === application._id) continue;

      if (sibling.status === "qualified") {
        await ctx.db.patch(sibling._id, { status: "refund_eligible" });
        refundEligibleIds.push(sibling._id);
        await notifyNotSelected(ctx, sibling._id);
      } else if (sibling.status === "first_month_due") {
        // Deposit paid but first month not yet — deposit still refundable.
        await ctx.db.patch(sibling._id, { status: "refund_eligible" });
        refundEligibleIds.push(sibling._id);
        await notifyNotSelected(ctx, sibling._id);
      } else if (
        sibling.status === "under_review" ||
        sibling.status === "fee_paid" ||
        sibling.status === "deposit_due" ||
        sibling.status === "approved"
      ) {
        await ctx.db.patch(sibling._id, { status: "denied" });
        await notifyDenied(ctx, sibling._id);
      }
    }

    await ctx.db.patch(args.applicationId, { status: "move_in_ready" });
    await ctx.db.patch(listing._id, { published: false });
    await ensureLeaseFromApplication(ctx, args.applicationId);
    await notifySelectedTenant(ctx, args.applicationId);

    for (const refundApplicationId of refundEligibleIds) {
      await ctx.scheduler.runAfter(
        0,
        internal.refundsActions.processForApplication,
        { applicationId: refundApplicationId },
      );
    }
    return null;
  },
});

export const markMoved = mutation({
  args: { orgId: v.id("orgs"), applicationId: v.id("applications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, [
      "org_owner",
      "leasing_agent",
    ]);

    const { application } = await requireApplicationInOrg(
      ctx,
      args.orgId,
      args.applicationId,
    );

    if (application.status !== "move_in_ready") {
      throw new Error("Only move-in ready applicants can be marked as moved");
    }

    await ctx.db.patch(args.applicationId, { status: "moved" });
    await notifyMovedIn(ctx, args.applicationId);
    return null;
  },
});
