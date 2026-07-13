"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

function requireStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export const createApplicationFeeCheckout = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const prepared = await ctx.runMutation(
      internal.payments.prepareApplicationFeeCheckout,
      {
        applicationId: args.applicationId,
        clerkUserId: identity.subject,
      },
    );

    const stripe = requireStripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: `${appUrl()}/applications/${args.applicationId}?checkout=success`,
        cancel_url: `${appUrl()}/applications/${args.applicationId}?checkout=canceled`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: prepared.amountCents,
              product_data: { name: "RentaMart application fee" },
            },
          },
        ],
        metadata: {
          applicationId: args.applicationId,
          paymentId: prepared.paymentId,
          type: "application_fee",
          idempotencyKey: prepared.idempotencyKey,
        },
      },
      { idempotencyKey: prepared.idempotencyKey },
    );

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    await ctx.runMutation(internal.payments.markCheckoutOpen, {
      paymentId: prepared.paymentId,
      stripeCheckoutSessionId: session.id,
      applicationId: args.applicationId,
    });

    return { url: session.url };
  },
});

export const verifyAndApplyWebhook = internalAction({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    deduped: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return { ok: false, error: "STRIPE_WEBHOOK_SECRET is not set" };
    }
    const stripe = requireStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        args.body,
        args.signature,
        webhookSecret,
      );
    } catch {
      return { ok: false, error: "Invalid signature" };
    }

    const existing = await ctx.runQuery(internal.payments.getStripeEvent, {
      stripeEventId: event.id,
    });
    if (existing) {
      return { ok: true, deduped: true };
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await ctx.runMutation(internal.payments.applyStripeCheckoutEvent, {
        stripeEventId: event.id,
        type: event.type,
        sessionId: session.id,
        paymentStatus: session.payment_status,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id,
        metadata: {
          applicationId: session.metadata?.applicationId,
          paymentId: session.metadata?.paymentId,
          idempotencyKey: session.metadata?.idempotencyKey,
          type: session.metadata?.type,
        },
      });
    } else {
      await ctx.runMutation(internal.payments.recordStripeEvent, {
        stripeEventId: event.id,
        type: event.type,
      });
    }

    return { ok: true, deduped: false };
  },
});
