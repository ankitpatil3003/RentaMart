"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function requireStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

export const processForApplication = internalAction({
  args: { applicationId: v.id("applications") },
  returns: v.object({
    processed: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const rows = await ctx.runMutation(internal.refunds.prepareRefundRows, {
      applicationId: args.applicationId,
    });

    if (rows.length === 0) {
      return { processed: 0, failed: 0 };
    }

    const stripe = requireStripe();
    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const refund = await stripe.refunds.create(
          {
            payment_intent: row.stripePaymentIntentId,
            reverse_transfer: true,
          },
          { idempotencyKey: row.idempotencyKey },
        );

        await ctx.runMutation(internal.refunds.markRefundSucceeded, {
          refundId: row.refundId,
          stripeRefundId: refund.id,
          paymentId: row.paymentId,
          applicationId: args.applicationId,
        });
        processed += 1;
      } catch (error) {
        console.error("Refund failed:", error);
        await ctx.runMutation(internal.refunds.markRefundFailed, {
          refundId: row.refundId,
        });
        failed += 1;
      }
    }

    return { processed, failed };
  },
});
