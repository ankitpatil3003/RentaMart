import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requirePlatformAdmin,
  requireUser,
  userHasRole,
} from "./lib/auth";
import { landlordRequestStatus } from "./schema";

const requestSummary = v.object({
  _id: v.id("landlordRequests"),
  orgName: v.string(),
  contactPhone: v.optional(v.string()),
  notes: v.optional(v.string()),
  status: landlordRequestStatus,
  adminNote: v.optional(v.string()),
  createdOrgId: v.optional(v.id("orgs")),
  createdAt: v.number(),
  reviewedAt: v.optional(v.number()),
  documentUrls: v.array(v.string()),
});

const adminRequestRow = v.object({
  _id: v.id("landlordRequests"),
  orgName: v.string(),
  contactPhone: v.optional(v.string()),
  notes: v.optional(v.string()),
  status: landlordRequestStatus,
  adminNote: v.optional(v.string()),
  createdAt: v.number(),
  userEmail: v.string(),
  userName: v.optional(v.string()),
  documentUrls: v.array(v.string()),
});

async function documentUrlsFor(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  ids: Array<Id<"_storage">>,
): Promise<string[]> {
  const urls: string[] = [];
  for (const id of ids) {
    const url = await ctx.storage.getUrl(id);
    if (url) urls.push(url);
  }
  return urls;
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const submit = mutation({
  args: {
    orgName: v.string(),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    documentStorageIds: v.array(v.id("_storage")),
  },
  returns: v.id("landlordRequests"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (userHasRole(user, "org_owner")) {
      const memberships = await ctx.db
        .query("orgMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      if (memberships.length > 0) {
        throw new Error("You already have landlord access");
      }
    }

    const orgName = args.orgName.trim();
    if (!orgName) {
      throw new Error("Organization name is required");
    }
    if (args.documentStorageIds.length < 1) {
      throw new Error("Upload at least one verification document");
    }

    const existing = await ctx.db
      .query("landlordRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const pending = existing.find((r) => r.status === "pending");
    if (pending) {
      throw new Error("You already have a pending landlord request");
    }

    return await ctx.db.insert("landlordRequests", {
      userId: user._id,
      orgName,
      contactPhone: args.contactPhone?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      documentStorageIds: args.documentStorageIds,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const getMine = query({
  args: {},
  returns: v.union(requestSummary, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", identity.subject),
      )
      .unique();
    if (!user) return null;

    const requests = await ctx.db
      .query("landlordRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (requests.length === 0) return null;

    requests.sort((a, b) => b.createdAt - a.createdAt);
    const latest = requests[0]!;
    return {
      _id: latest._id,
      orgName: latest.orgName,
      contactPhone: latest.contactPhone,
      notes: latest.notes,
      status: latest.status,
      adminNote: latest.adminNote,
      createdOrgId: latest.createdOrgId,
      createdAt: latest.createdAt,
      reviewedAt: latest.reviewedAt,
      documentUrls: await documentUrlsFor(ctx, latest.documentStorageIds),
    };
  },
});

export const listPending = query({
  args: {},
  returns: v.array(adminRequestRow),
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const pending = await ctx.db
      .query("landlordRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const rows = [];
    for (const request of pending) {
      const user = await ctx.db.get(request.userId);
      rows.push({
        _id: request._id,
        orgName: request.orgName,
        contactPhone: request.contactPhone,
        notes: request.notes,
        status: request.status,
        adminNote: request.adminNote,
        createdAt: request.createdAt,
        userEmail: user?.email ?? "unknown",
        userName: user?.name,
        documentUrls: await documentUrlsFor(ctx, request.documentStorageIds),
      });
    }
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
  },
});

export const approve = mutation({
  args: {
    requestId: v.id("landlordRequests"),
    adminNote: v.optional(v.string()),
  },
  returns: v.id("orgs"),
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }
    if (request.status !== "pending") {
      throw new Error("Request is not pending");
    }

    const owner = await ctx.db.get(request.userId);
    if (!owner) {
      throw new Error("Requesting user not found");
    }

    const orgId = await ctx.db.insert("orgs", {
      name: request.orgName,
      connectReady: false,
    });
    await ctx.db.insert("orgMembers", {
      orgId,
      userId: owner._id,
      role: "org_owner",
    });
    if (!userHasRole(owner, "org_owner")) {
      await ctx.db.patch(owner._id, {
        roles: [...owner.roles, "org_owner"],
      });
    }

    await ctx.db.patch(args.requestId, {
      status: "approved",
      adminNote: args.adminNote?.trim() || undefined,
      reviewedByUserId: admin._id,
      reviewedAt: Date.now(),
      createdOrgId: orgId,
    });

    return orgId;
  },
});

export const deny = mutation({
  args: {
    requestId: v.id("landlordRequests"),
    adminNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }
    if (request.status !== "pending") {
      throw new Error("Request is not pending");
    }

    await ctx.db.patch(args.requestId, {
      status: "denied",
      adminNote: args.adminNote?.trim() || undefined,
      reviewedByUserId: admin._id,
      reviewedAt: Date.now(),
    });
    return null;
  },
});
