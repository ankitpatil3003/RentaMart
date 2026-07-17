import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  requireOrgMember,
  requireOrgRole,
  requirePlatformAdmin,
  requireUser,
  userHasRole,
} from "./lib/auth";
import { getOrgListingTrust } from "./lib/listingTrust";

const orgDetail = v.object({
  _id: v.id("orgs"),
  name: v.string(),
  connectReady: v.boolean(),
  stripeConnectAccountId: v.optional(v.string()),
  listingFastPath: v.boolean(),
  approvedListingCount: v.number(),
  deniedListingCount: v.number(),
  minApprovedForFastPath: v.number(),
});

const orgSummary = v.object({
  _id: v.id("orgs"),
  name: v.string(),
  connectReady: v.boolean(),
  listingFastPath: v.boolean(),
  role: v.union(v.literal("org_owner"), v.literal("leasing_agent")),
});

export const create = mutation({
  args: {
    name: v.string(),
    ownerUserId: v.optional(v.id("users")),
  },
  returns: v.id("orgs"),
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Organization name is required");
    }

    const orgId = await ctx.db.insert("orgs", {
      name,
      connectReady: false,
    });

    if (args.ownerUserId) {
      const owner = await ctx.db.get(args.ownerUserId);
      if (!owner) {
        throw new Error("Owner user not found");
      }
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
    }

    return orgId;
  },
});

export const listMine = query({
  args: {},
  returns: v.array(orgSummary),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const orgs = [];
    for (const membership of memberships) {
      const org = await ctx.db.get(membership.orgId);
      if (!org) continue;
      const trust = await getOrgListingTrust(ctx, org._id);
      orgs.push({
        _id: org._id,
        name: org.name,
        connectReady: org.connectReady,
        listingFastPath: trust.eligible,
        role: membership.role,
      });
    }
    return orgs;
  },
});

export const get = query({
  args: { orgId: v.id("orgs") },
  returns: v.union(orgDetail, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    let membership;
    try {
      membership = await requireOrgMember(ctx, user, args.orgId);
    } catch {
      return null;
    }
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    const trust = await getOrgListingTrust(ctx, args.orgId);
    return {
      _id: org._id,
      name: org.name,
      connectReady: org.connectReady,
      stripeConnectAccountId:
        membership.role === "org_owner"
          ? org.stripeConnectAccountId
          : undefined,
      listingFastPath: trust.eligible,
      approvedListingCount: trust.approvedCount,
      deniedListingCount: trust.deniedCount,
      minApprovedForFastPath: trust.minApprovedRequired,
    };
  },
});

/**
 * @deprecated Use orgInvites.create (pending invite + accept). Kept for
 * compatibility: creates a pending invite instead of immediate membership.
 */
export const inviteMember = mutation({
  args: { orgId: v.id("orgs"), email: v.string() },
  returns: v.id("orgInvites"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, ["org_owner"]);

    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required");
    }
    const invitee = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!invitee) {
      throw new Error("No user found with that email. They must sign up first.");
    }
    if (invitee._id === user._id) {
      throw new Error("You cannot invite yourself");
    }

    const inviteeMemberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", invitee._id))
      .collect();
    const approvedRequest = (
      await ctx.db
        .query("landlordRequests")
        .withIndex("by_user", (q) => q.eq("userId", invitee._id))
        .collect()
    ).find((r) => r.status === "approved");

    if (inviteeMemberships.length === 0 && !approvedRequest) {
      throw new Error(
        "Invitee must complete landlord verification before joining an organization",
      );
    }

    const existingMember = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", invitee._id),
      )
      .unique();
    if (existingMember) {
      throw new Error("User is already a member of this organization");
    }

    const pending = (
      await ctx.db
        .query("orgInvites")
        .withIndex("by_org_and_email", (q) =>
          q.eq("orgId", args.orgId).eq("email", email),
        )
        .collect()
    ).find((row) => row.status === "pending");
    if (pending) {
      return pending._id;
    }

    return await ctx.db.insert("orgInvites", {
      orgId: args.orgId,
      email,
      inviteeUserId: invitee._id,
      invitedByUserId: user._id,
      role: "leasing_agent",
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const getForConnectOnboarding = internalQuery({
  args: { orgId: v.id("orgs"), clerkUserId: v.string() },
  returns: v.union(
    v.object({
      orgId: v.id("orgs"),
      name: v.string(),
      stripeConnectAccountId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) return null;
    try {
      await requireOrgRole(ctx, user, args.orgId, ["org_owner"]);
    } catch {
      return null;
    }
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    return {
      orgId: org._id,
      name: org.name,
      stripeConnectAccountId: org.stripeConnectAccountId,
    };
  },
});

export const getOrgByStripeConnectAccountId = internalQuery({
  args: { stripeConnectAccountId: v.string() },
  returns: v.union(v.object({ orgId: v.id("orgs") }), v.null()),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_stripeConnectAccountId", (q) =>
        q.eq("stripeConnectAccountId", args.stripeConnectAccountId),
      )
      .unique();
    if (!org) return null;
    return { orgId: org._id };
  },
});

export const setConnectAccount = internalMutation({
  args: {
    orgId: v.id("orgs"),
    stripeConnectAccountId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      stripeConnectAccountId: args.stripeConnectAccountId,
    });
    return null;
  },
});

export const setConnectReady = internalMutation({
  args: {
    orgId: v.id("orgs"),
    connectReady: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, { connectReady: args.connectReady });
    return null;
  },
});
