import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireUser } from "./lib/auth";
import { appFeeIdempotencyKey } from "./lib/money";
import { paymentStatus, paymentType } from "./schema";

export const getByApplication = query({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.object({
      _id: v.id("payments"),
      type: paymentType,
      status: paymentStatus,
      amountCents: v.number(),
      idempotencyKey: v.string(),
      stripeCheckoutSessionId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.renterUserId !== user._id) {
      return null;
    }
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .order("desc")
      .first();
    if (!payment || payment.type !== "application_fee") return null;
    return {
      _id: payment._id,
      type: payment.type,
      status: payment.status,
      amountCents: payment.amountCents,
      idempotencyKey: payment.idempotencyKey,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
    };
  },
});

export const prepareApplicationFeeCheckout = internalMutation({
  args: { applicationId: v.id("applications"), clerkUserId: v.string() },
  returns: v.object({
    paymentId: v.id("payments"),
    amountCents: v.number(),
    idempotencyKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found");
    const user = await ctx.db.get(application.renterUserId);
    if (!user || user.clerkUserId !== args.clerkUserId) {
      throw new Error("Unauthorized");
    }
    if (
      application.status !== "submitted" &&
      application.status !== "fee_pending" &&
      application.status !== "fee_failed"
    ) {
      throw new Error("Application is not ready for fee payment");
    }
    const listing = await ctx.db.get(application.listingId);
    if (!listing) throw new Error("Listing not found");

    const idempotencyKey = appFeeIdempotencyKey(args.applicationId);
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_idempotencyKey", (q) =>
        q.eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing?.status === "succeeded") {
      throw new Error("Application fee already paid");
    }
    if (existing) {
      return {
        paymentId: existing._id,
        amountCents: existing.amountCents,
        idempotencyKey: existing.idempotencyKey,
      };
    }
    const paymentId = await ctx.db.insert("payments", {
      applicationId: args.applicationId,
      type: "application_fee",
      status: "created",
      amountCents: listing.applicationFeeCents,
      currency: "usd",
      idempotencyKey,
    });
    return {
      paymentId,
      amountCents: listing.applicationFeeCents,
      idempotencyKey,
    };
  },
});

export const markCheckoutOpen = internalMutation({
  args: {
    paymentId: v.id("payments"),
    applicationId: v.id("applications"),
    stripeCheckoutSessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, {
      status: "checkout_open",
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
    });
    const application = await ctx.db.get(args.applicationId);
    if (
      application &&
      (application.status === "submitted" ||
        application.status === "fee_failed" ||
        application.status === "fee_pending")
    ) {
      await ctx.db.patch(args.applicationId, { status: "fee_pending" });
    }
    return null;
  },
});

export const getStripeEvent = internalQuery({
  args: { stripeEventId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("stripeEvents"),
      stripeEventId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("stripeEvents")
      .withIndex("by_stripeEventId", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .unique();
    if (!event) return null;
    return { _id: event._id, stripeEventId: event.stripeEventId };
  },
});

export const recordStripeEvent = internalMutation({
  args: { stripeEventId: v.string(), type: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripeEvents")
      .withIndex("by_stripeEventId", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .unique();
    if (existing) return null;
    await ctx.db.insert("stripeEvents", {
      stripeEventId: args.stripeEventId,
      type: args.type,
      processedAt: Date.now(),
    });
    return null;
  },
});

export const applyStripeCheckoutEvent = internalMutation({
  args: {
    stripeEventId: v.string(),
    type: v.string(),
    sessionId: v.string(),
    paymentStatus: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    metadata: v.object({
      applicationId: v.optional(v.string()),
      paymentId: v.optional(v.string()),
      idempotencyKey: v.optional(v.string()),
      type: v.optional(v.string()),
    }),
  },
  returns: v.object({ applied: v.boolean(), deduped: v.boolean() }),
  handler: async (ctx, args) => {
    const already = await ctx.db
      .query("stripeEvents")
      .withIndex("by_stripeEventId", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .unique();
    if (already) {
      return { applied: false, deduped: true };
    }

    let payment = null;
    if (args.metadata.idempotencyKey) {
      payment = await ctx.db
        .query("payments")
        .withIndex("by_idempotencyKey", (q) =>
          q.eq("idempotencyKey", args.metadata.idempotencyKey!),
        )
        .unique();
    }
    if (!payment) {
      payment = await ctx.db
        .query("payments")
        .withIndex("by_checkoutSession", (q) =>
          q.eq("stripeCheckoutSessionId", args.sessionId),
        )
        .unique();
    }
    if (!payment) {
      await ctx.db.insert("stripeEvents", {
        stripeEventId: args.stripeEventId,
        type: args.type,
        processedAt: Date.now(),
      });
      return { applied: false, deduped: false };
    }

    if (payment.status === "succeeded") {
      await ctx.db.insert("stripeEvents", {
        stripeEventId: args.stripeEventId,
        type: args.type,
        processedAt: Date.now(),
      });
      return { applied: false, deduped: true };
    }

    const success =
      args.type === "checkout.session.completed" &&
      (args.paymentStatus === "paid" ||
        args.paymentStatus === "no_payment_required" ||
        args.paymentStatus === undefined ||
        args.paymentStatus === "complete");

    const failed =
      args.type === "checkout.session.async_payment_failed" ||
      args.type === "checkout.session.expired";

    if (success) {
      await ctx.db.patch(payment._id, {
        status: "succeeded",
        stripeEventId: args.stripeEventId,
        stripePaymentIntentId: args.paymentIntentId,
        stripeCheckoutSessionId: args.sessionId,
      });
      await ctx.db.patch(payment.applicationId, { status: "fee_paid" });
    } else if (failed) {
      await ctx.db.patch(payment._id, {
        status: "failed",
        stripeEventId: args.stripeEventId,
        stripeCheckoutSessionId: args.sessionId,
      });
      const application = await ctx.db.get(payment.applicationId);
      if (
        application &&
        (application.status === "fee_pending" ||
          application.status === "submitted")
      ) {
        await ctx.db.patch(payment.applicationId, { status: "fee_failed" });
      }
    }

    await ctx.db.insert("stripeEvents", {
      stripeEventId: args.stripeEventId,
      type: args.type,
      processedAt: Date.now(),
    });
    return { applied: success || failed, deduped: false };
  },
});
