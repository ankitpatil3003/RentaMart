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
  requireUser,
  userHasRole,
} from "./lib/auth";

const orgDetail = v.object({
  _id: v.id("orgs"),
  name: v.string(),
  connectReady: v.boolean(),
  stripeConnectAccountId: v.optional(v.string()),
});

const orgSummary = v.object({
  _id: v.id("orgs"),
  name: v.string(),
  connectReady: v.boolean(),
  role: v.union(v.literal("org_owner"), v.literal("leasing_agent")),
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("orgs"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Organization name is required");
    }

    const orgId = await ctx.db.insert("orgs", {
      name,
      connectReady: false,
    });
    await ctx.db.insert("orgMembers", {
      orgId,
      userId: user._id,
      role: "org_owner",
    });
    if (!userHasRole(user, "org_owner")) {
      await ctx.db.patch(user._id, {
        roles: [...user.roles, "org_owner"],
      });
    }
    return orgId;
  },
});

export const listMine = query({
  args: {},
  returns: v.array(orgSummary),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const orgs = [];
    for (const membership of memberships) {
      const org = await ctx.db.get(membership.orgId);
      if (!org) continue;
      orgs.push({
        _id: org._id,
        name: org.name,
        connectReady: org.connectReady,
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
    try {
      await requireOrgMember(ctx, user, args.orgId);
    } catch {
      return null;
    }
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    return {
      _id: org._id,
      name: org.name,
      connectReady: org.connectReady,
      stripeConnectAccountId: org.stripeConnectAccountId,
    };
  },
});

export const inviteMember = mutation({
  args: { orgId: v.id("orgs"), email: v.string() },
  returns: v.id("orgMembers"),
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
      throw new Error("No user found with that email");
    }

    const existing = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", invitee._id),
      )
      .unique();
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("orgMembers", {
      orgId: args.orgId,
      userId: invitee._id,
      role: "leasing_agent",
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
