import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOrgMember, requireUser } from "./lib/auth";
import { notificationType } from "./schema";

const notificationRecord = v.object({
  _id: v.id("notifications"),
  applicationId: v.id("applications"),
  orgId: v.optional(v.id("orgs")),
  type: notificationType,
  title: v.string(),
  body: v.string(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
  listingTitle: v.optional(v.string()),
});

export const isEmailEnabled = query({
  args: {},
  returns: v.object({ enabled: v.boolean() }),
  handler: async () => {
    return { enabled: process.env.EMAIL_ENABLED === "true" };
  },
});

export const getForEmail = internalQuery({
  args: { notificationId: v.id("notifications") },
  returns: v.union(
    v.object({
      notificationId: v.id("notifications"),
      title: v.string(),
      body: v.string(),
      orgId: v.optional(v.id("orgs")),
      toEmail: v.string(),
      emailSentAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return null;
    const user = await ctx.db.get(notification.userId);
    if (!user) return null;
    return {
      notificationId: notification._id,
      title: notification.title,
      body: notification.body,
      orgId: notification.orgId,
      toEmail: user.email,
      emailSentAt: notification.emailSentAt,
    };
  },
});

export const markEmailSent = internalMutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return null;
    if (notification.emailSentAt === undefined) {
      await ctx.db.patch(args.notificationId, { emailSentAt: Date.now() });
    }
    return null;
  },
});

export const listMine = query({
  args: {},
  returns: v.array(notificationRecord),
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    notifications.sort((a, b) => b.createdAt - a.createdAt);

    const results = [];
    for (const notification of notifications.slice(0, 50)) {
      const application = await ctx.db.get(notification.applicationId);
      const listing = application
        ? await ctx.db.get(application.listingId)
        : null;
      results.push({
        _id: notification._id,
        applicationId: notification.applicationId,
        orgId: notification.orgId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        listingTitle: listing?.title,
      });
    }
    return results;
  },
});

export const listForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(notificationRecord),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const filtered = notifications
      .filter((n) => n.orgId === args.orgId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);

    const results = [];
    for (const notification of filtered) {
      const application = await ctx.db.get(notification.applicationId);
      const listing = application
        ? await ctx.db.get(application.listingId)
        : null;
      results.push({
        _id: notification._id,
        applicationId: notification.applicationId,
        orgId: notification.orgId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        listingTitle: listing?.title,
      });
    }
    return results;
  },
});

export const unreadCount = query({
  args: { orgId: v.optional(v.id("orgs")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return 0;

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return notifications.filter((notification) => {
      if (notification.readAt !== undefined) return false;
      if (args.orgId !== undefined) {
        return notification.orgId === args.orgId;
      }
      return notification.orgId === undefined;
    }).length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== user._id) {
      throw new Error("Notification not found");
    }
    if (notification.readAt === undefined) {
      await ctx.db.patch(args.notificationId, { readAt: Date.now() });
    }
    return null;
  },
});

export const markAllRead = mutation({
  args: { orgId: v.optional(v.id("orgs")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.orgId !== undefined) {
      await requireOrgMember(ctx, user, args.orgId);
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let marked = 0;
    const now = Date.now();
    for (const notification of notifications) {
      if (notification.readAt !== undefined) continue;
      if (args.orgId !== undefined && notification.orgId !== args.orgId) {
        continue;
      }
      if (args.orgId === undefined && notification.orgId !== undefined) {
        continue;
      }
      await ctx.db.patch(notification._id, { readAt: now });
      marked += 1;
    }
    return marked;
  },
});
