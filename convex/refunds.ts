import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOrgMember, requireOrgRole, requireUser } from "./lib/auth";
import { notifyRefundCompleted } from "./lib/notificationHelpers";
import { refundStatus } from "./schema";

const refundRecord = v.object({
  _id: v.id("refunds"),
  applicationId: v.id("applications"),
  paymentId: v.id("payments"),
  amountCents: v.number(),
  status: refundStatus,
  stripeRefundId: v.optional(v.string()),
});

export const listForApplication = query({
  args: { applicationId: v.id("applications") },
  returns: v.array(refundRecord),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const application = await ctx.db.get(args.applicationId);
    if (!application || application.renterUserId !== user._id) return [];

    const refunds = await ctx.db
      .query("refunds")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();

    return refunds.map((refund) => ({
      _id: refund._id,
      applicationId: refund.applicationId,
      paymentId: refund.paymentId,
      amountCents: refund.amountCents,
      status: refund.status,
      stripeRefundId: refund.stripeRefundId,
    }));
  },
});

export const listEligibleForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(
    v.object({
      applicationId: v.id("applications"),
      fullName: v.string(),
      listingTitle: v.string(),
      status: v.string(),
      refundableCents: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const eligible = [];
    for (const listing of listings) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
        .collect();

      for (const application of applications) {
        if (
          application.status !== "refund_eligible" &&
          application.status !== "refunded"
        ) {
          continue;
        }

        const payments = await ctx.db
          .query("payments")
          .withIndex("by_application", (q) =>
            q.eq("applicationId", application._id),
          )
          .collect();

        let refundableCents = 0;
        for (const payment of payments) {
          if (
            (payment.type === "deposit" || payment.type === "first_month") &&
            payment.status === "succeeded"
          ) {
            refundableCents += payment.amountCents;
          }
        }

        eligible.push({
          applicationId: application._id,
          fullName: application.fullName,
          listingTitle: listing.title,
          status: application.status,
          refundableCents,
        });
      }
    }

    return eligible;
  },
});

export const prepareRefundRows = internalMutation({
  args: { applicationId: v.id("applications") },
  returns: v.array(
    v.object({
      refundId: v.id("refunds"),
      paymentId: v.id("payments"),
      amountCents: v.number(),
      idempotencyKey: v.string(),
      stripePaymentIntentId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) {
      throw new Error("Application not found");
    }
    if (
      application.status !== "refund_eligible" &&
      application.status !== "refunded"
    ) {
      throw new Error("Application is not eligible for refund");
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .collect();

    const rows = [];
    for (const payment of payments) {
      if (
        (payment.type !== "deposit" && payment.type !== "first_month") ||
        payment.status !== "succeeded" ||
        !payment.stripePaymentIntentId
      ) {
        continue;
      }

      const existing = await ctx.db
        .query("refunds")
        .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
        .unique();

      if (existing?.status === "succeeded") continue;

      const idempotencyKey = `refund:${payment._id}`;
      let refundId = existing?._id;

      if (!existing) {
        refundId = await ctx.db.insert("refunds", {
          applicationId: args.applicationId,
          paymentId: payment._id,
          amountCents: payment.amountCents,
          status: "pending",
          idempotencyKey,
          createdAt: Date.now(),
        });
      } else if (existing.status === "failed") {
        await ctx.db.patch(existing._id, { status: "pending" });
      } else if (existing.status === "pending") {
        // retry
      } else {
        continue;
      }

      rows.push({
        refundId: refundId!,
        paymentId: payment._id,
        amountCents: payment.amountCents,
        idempotencyKey,
        stripePaymentIntentId: payment.stripePaymentIntentId,
      });
    }

    return rows;
  },
});

export const markRefundSucceeded = internalMutation({
  args: {
    refundId: v.id("refunds"),
    stripeRefundId: v.string(),
    paymentId: v.id("payments"),
    applicationId: v.id("applications"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.refundId, {
      status: "succeeded",
      stripeRefundId: args.stripeRefundId,
      processedAt: Date.now(),
    });
    await ctx.db.patch(args.paymentId, { status: "refunded" });

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .collect();

    const refundableTypes = new Set(["deposit", "first_month"]);
    const hadRefundable = payments.some(
      (p) => refundableTypes.has(p.type) && p.status !== "refunded",
    );

    if (!hadRefundable) {
      await ctx.db.patch(args.applicationId, { status: "refunded" });
      await notifyRefundCompleted(ctx, args.applicationId);
    }

    return null;
  },
});

export const markRefundFailed = internalMutation({
  args: { refundId: v.id("refunds") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.refundId, {
      status: "failed",
      processedAt: Date.now(),
    });
    return null;
  },
});

export const processForApplication = mutation({
  args: {
    orgId: v.id("orgs"),
    applicationId: v.id("applications"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, [
      "org_owner",
      "leasing_agent",
    ]);

    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found");
    const listing = await ctx.db.get(application.listingId);
    if (!listing || listing.orgId !== args.orgId) {
      throw new Error("Application not found");
    }
    if (application.status !== "refund_eligible") {
      throw new Error("Application is not eligible for refund");
    }

    await ctx.scheduler.runAfter(0, internal.refundsActions.processForApplication, {
      applicationId: args.applicationId,
    });
    return null;
  },
});
