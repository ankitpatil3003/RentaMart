import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";
import { role } from "./schema";

export const me = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      roles: v.array(role),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };
  },
});

export const ensureUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (existing) return existing._id;
    const email = identity.email ?? `${identity.subject}@users.clerk.local`;
    return await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      email,
      name: identity.name,
      roles: ["renter"],
    });
  },
});
