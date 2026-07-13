import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
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
