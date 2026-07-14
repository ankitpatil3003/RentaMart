import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import {
  requireOrgMember,
  requireOrgRole,
  requireUser,
} from "./lib/auth";
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
    const user = await requireUser(ctx);
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

const applicationReview = v.object({
  _id: v.id("applications"),
  listingId: v.id("listings"),
  status: applicationStatus,
  fullName: v.string(),
  email: v.string(),
  phone: v.string(),
  message: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
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
    return null;
  },
});
