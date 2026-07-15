import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOrgMember, requireUser, getCurrentUserOrNull } from "./lib/auth";
import { ensureChargesForLeaseInternal } from "./rent";
import { leaseStatus } from "./schema";

const leaseSummary = v.object({
  _id: v.id("leases"),
  applicationId: v.id("applications"),
  listingId: v.id("listings"),
  listingTitle: v.string(),
  orgId: v.id("orgs"),
  rentCents: v.number(),
  dueDayOfMonth: v.number(),
  startDate: v.number(),
  status: leaseStatus,
});

async function leaseWithListing(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  lease: {
    _id: Id<"leases">;
    applicationId: Id<"applications">;
    listingId: Id<"listings">;
    orgId: Id<"orgs">;
    rentCents: number;
    dueDayOfMonth: number;
    startDate: number;
    status: "active" | "ended";
  },
) {
  const listing = await ctx.db.get(lease.listingId);
  return {
    _id: lease._id,
    applicationId: lease.applicationId,
    listingId: lease.listingId,
    listingTitle: listing?.title ?? "Listing",
    orgId: lease.orgId,
    rentCents: lease.rentCents,
    dueDayOfMonth: lease.dueDayOfMonth,
    startDate: lease.startDate,
    status: lease.status,
  };
}

export async function ensureLeaseFromApplication(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<Id<"leases">> {
  const existing = await ctx.db
    .query("leases")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .unique();
  if (existing) {
    await ensureChargesForLeaseInternal(ctx, existing._id);
    return existing._id;
  }

  const application = await ctx.db.get(applicationId);
  if (!application || application.status !== "move_in_ready") {
    throw new Error("Application is not move-in ready");
  }

  const listing = await ctx.db.get(application.listingId);
  if (!listing) throw new Error("Listing not found");

  const leaseId = await ctx.db.insert("leases", {
    applicationId,
    listingId: application.listingId,
    orgId: listing.orgId,
    renterUserId: application.renterUserId,
    rentCents: listing.rentCents,
    dueDayOfMonth: 1,
    startDate: Date.now(),
    status: "active",
  });
  await ensureChargesForLeaseInternal(ctx, leaseId);
  return leaseId;
}

export const ensureFromApplication = internalMutation({
  args: { applicationId: v.id("applications") },
  returns: v.id("leases"),
  handler: async (ctx, args) => {
    return await ensureLeaseFromApplication(ctx, args.applicationId);
  },
});

export const getByApplication = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.object({
      _id: v.id("leases"),
      orgId: v.id("orgs"),
      renterUserId: v.id("users"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("leases")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .unique();
    if (!lease) return null;
    return {
      _id: lease._id,
      orgId: lease.orgId,
      renterUserId: lease.renterUserId,
    };
  },
});

export const listMine = query({
  args: {},
  returns: v.array(leaseSummary),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const leases = await ctx.db
      .query("leases")
      .withIndex("by_renter", (q) => q.eq("renterUserId", user._id))
      .collect();

    const summaries = [];
    for (const lease of leases) {
      summaries.push(await leaseWithListing(ctx, lease));
    }
    return summaries;
  },
});

export const listForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(
    v.object({
      ...leaseSummary.fields,
      renterName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const leases = await ctx.db
      .query("leases")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const summaries = [];
    for (const lease of leases) {
      const base = await leaseWithListing(ctx, lease);
      const renter = await ctx.db.get(lease.renterUserId);
      summaries.push({
        ...base,
        renterName: renter?.name ?? renter?.email ?? "Renter",
      });
    }
    return summaries;
  },
});

export const getMine = query({
  args: { leaseId: v.id("leases") },
  returns: v.union(leaseSummary, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return null;

    const lease = await ctx.db.get(args.leaseId);
    if (!lease || lease.renterUserId !== user._id) return null;
    return await leaseWithListing(ctx, lease);
  },
});

export const backfillMine = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Soft no-op until ensureUser has created the profile (auth race).
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return 0;

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_renter", (q) => q.eq("renterUserId", user._id))
      .collect();

    let touched = 0;
    for (const application of applications) {
      if (application.status !== "move_in_ready") continue;
      await ensureLeaseFromApplication(ctx, application._id);
      touched += 1;
    }
    return touched;
  },
});
