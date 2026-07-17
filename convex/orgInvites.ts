import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireOrgMember,
  requireOrgRole,
  requireUser,
  userHasRole,
} from "./lib/auth";
import { orgInviteStatus } from "./schema";

const memberRow = v.object({
  _id: v.id("orgMembers"),
  userId: v.id("users"),
  email: v.string(),
  name: v.optional(v.string()),
  role: v.union(v.literal("org_owner"), v.literal("leasing_agent")),
});

const inviteForOrg = v.object({
  _id: v.id("orgInvites"),
  email: v.string(),
  inviteeName: v.optional(v.string()),
  status: orgInviteStatus,
  createdAt: v.number(),
  respondedAt: v.optional(v.number()),
});

const inviteForMe = v.object({
  _id: v.id("orgInvites"),
  orgId: v.id("orgs"),
  orgName: v.string(),
  invitedByEmail: v.string(),
  status: orgInviteStatus,
  createdAt: v.number(),
});

async function assertInviteeVerified(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  inviteeUserId: import("./_generated/dataModel").Id<"users">,
) {
  const memberships = await ctx.db
    .query("orgMembers")
    .withIndex("by_user", (q) => q.eq("userId", inviteeUserId))
    .collect();
  const approvedRequest = (
    await ctx.db
      .query("landlordRequests")
      .withIndex("by_user", (q) => q.eq("userId", inviteeUserId))
      .collect()
  ).find((r) => r.status === "approved");

  if (memberships.length === 0 && !approvedRequest) {
    throw new Error(
      "Invitee must complete landlord verification before joining an organization",
    );
  }
}

export const listMembers = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(memberRow),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);
    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const rows = [];
    for (const membership of memberships) {
      const member = await ctx.db.get(membership.userId);
      if (!member) continue;
      rows.push({
        _id: membership._id,
        userId: membership.userId,
        email: member.email,
        name: member.name,
        role: membership.role,
      });
    }
    return rows;
  },
});

export const listForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(inviteForOrg),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, ["org_owner"]);
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const rows = [];
    for (const invite of invites) {
      const invitee = await ctx.db.get(invite.inviteeUserId);
      rows.push({
        _id: invite._id,
        email: invite.email,
        inviteeName: invitee?.name,
        status: invite.status,
        createdAt: invite.createdAt,
        respondedAt: invite.respondedAt,
      });
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const listPendingForMe = query({
  args: {},
  returns: v.array(inviteForMe),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", identity.subject),
      )
      .unique();
    if (!user) return [];

    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_invitee_and_status", (q) =>
        q.eq("inviteeUserId", user._id).eq("status", "pending"),
      )
      .collect();

    const rows = [];
    for (const invite of invites) {
      const org = await ctx.db.get(invite.orgId);
      const inviter = await ctx.db.get(invite.invitedByUserId);
      rows.push({
        _id: invite._id,
        orgId: invite.orgId,
        orgName: org?.name ?? "Organization",
        invitedByEmail: inviter?.email ?? "unknown",
        status: invite.status,
        createdAt: invite.createdAt,
      });
    }
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
  },
});

export const create = mutation({
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

    await assertInviteeVerified(ctx, invitee._id);

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

export const cancel = mutation({
  args: { orgId: v.id("orgs"), inviteId: v.id("orgInvites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, ["org_owner"]);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.orgId !== args.orgId) {
      throw new Error("Invite not found");
    }
    if (invite.status !== "pending") {
      throw new Error("Only pending invites can be canceled");
    }
    await ctx.db.patch(args.inviteId, {
      status: "canceled",
      respondedAt: Date.now(),
    });
    return null;
  },
});

export const accept = mutation({
  args: { inviteId: v.id("orgInvites") },
  returns: v.id("orgs"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invite not found");
    }
    if (invite.inviteeUserId !== user._id) {
      throw new Error("This invite is not for you");
    }
    if (invite.status !== "pending") {
      throw new Error("Invite is no longer pending");
    }

    await assertInviteeVerified(ctx, user._id);

    const existing = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("orgId", invite.orgId).eq("userId", user._id),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("orgMembers", {
        orgId: invite.orgId,
        userId: user._id,
        role: "leasing_agent",
      });
    }
    if (!userHasRole(user, "leasing_agent") && !userHasRole(user, "org_owner")) {
      await ctx.db.patch(user._id, {
        roles: [...user.roles, "leasing_agent"],
      });
    }

    await ctx.db.patch(args.inviteId, {
      status: "accepted",
      respondedAt: Date.now(),
    });
    return invite.orgId;
  },
});

export const decline = mutation({
  args: { inviteId: v.id("orgInvites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invite not found");
    }
    if (invite.inviteeUserId !== user._id) {
      throw new Error("This invite is not for you");
    }
    if (invite.status !== "pending") {
      throw new Error("Invite is no longer pending");
    }
    await ctx.db.patch(args.inviteId, {
      status: "declined",
      respondedAt: Date.now(),
    });
    return null;
  },
});
