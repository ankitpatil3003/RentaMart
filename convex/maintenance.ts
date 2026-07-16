import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgMember, requireUser } from "./lib/auth";
import {
  maintenancePriority,
  maintenanceStatus,
} from "./schema";

const requestRecord = v.object({
  _id: v.id("maintenanceRequests"),
  leaseId: v.id("leases"),
  title: v.string(),
  description: v.string(),
  priority: maintenancePriority,
  status: maintenanceStatus,
  createdAt: v.number(),
  updatedAt: v.number(),
  listingTitle: v.string(),
});

export const create = mutation({
  args: {
    leaseId: v.id("leases"),
    title: v.string(),
    description: v.string(),
    priority: maintenancePriority,
  },
  returns: v.id("maintenanceRequests"),
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const description = args.description.trim();
    if (!title) throw new Error("Title is required");
    if (!description) throw new Error("Description is required");

    const user = await requireUser(ctx);
    const lease = await ctx.db.get(args.leaseId);
    if (!lease || lease.renterUserId !== user._id || lease.status !== "active") {
      throw new Error("Lease not found");
    }

    const now = Date.now();
    return await ctx.db.insert("maintenanceRequests", {
      leaseId: lease._id,
      orgId: lease.orgId,
      renterUserId: user._id,
      title,
      description,
      priority: args.priority,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listForRenter = query({
  args: {},
  returns: v.array(requestRecord),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const requests = await ctx.db
      .query("maintenanceRequests")
      .withIndex("by_renter", (q) => q.eq("renterUserId", user._id))
      .collect();

    const rows = [];
    for (const request of requests) {
      const lease = await ctx.db.get(request.leaseId);
      const listing = lease ? await ctx.db.get(lease.listingId) : null;
      rows.push({
        _id: request._id,
        leaseId: request.leaseId,
        title: request.title,
        description: request.description,
        priority: request.priority,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        listingTitle: listing?.title ?? "Listing",
      });
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const listForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(
    v.object({
      ...requestRecord.fields,
      renterName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const requests = await ctx.db
      .query("maintenanceRequests")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const rows = [];
    for (const request of requests) {
      const lease = await ctx.db.get(request.leaseId);
      const listing = lease ? await ctx.db.get(lease.listingId) : null;
      const renter = await ctx.db.get(request.renterUserId);
      rows.push({
        _id: request._id,
        leaseId: request.leaseId,
        title: request.title,
        description: request.description,
        priority: request.priority,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        listingTitle: listing?.title ?? "Listing",
        renterName: renter?.name ?? renter?.email ?? "Renter",
      });
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const updateStatus = mutation({
  args: {
    requestId: v.id("maintenanceRequests"),
    orgId: v.id("orgs"),
    status: maintenanceStatus,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.orgId !== args.orgId) {
      throw new Error("Maintenance request not found");
    }

    await ctx.db.patch(args.requestId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});
