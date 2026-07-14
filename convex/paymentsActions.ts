"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";

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

type CheckoutPrepareResult = {
  paymentId: Id<"payments">;
  amountCents: number;
  idempotencyKey: string;
};

async function prepareCheckout(
  ctx: ActionCtx,
  applicationId: Id<"applications">,
  clerkUserId: string,
  paymentType: "application_fee" | "deposit" | "first_month",
): Promise<CheckoutPrepareResult> {
  switch (paymentType) {
    case "application_fee":
      return await ctx.runMutation(internal.payments.prepareApplicationFeeCheckout, {
        applicationId,
        clerkUserId,
      });
    case "deposit":
      return await ctx.runMutation(internal.payments.prepareDepositCheckout, {
        applicationId,
        clerkUserId,
      });
    case "first_month":
      return await ctx.runMutation(internal.payments.prepareFirstMonthCheckout, {
        applicationId,
        clerkUserId,
      });
  }
}

async function createCheckoutSession(
  ctx: ActionCtx,
  args: {
    applicationId: Id<"applications">;
    clerkUserId: string;
    productName: string;
    paymentType: "application_fee" | "deposit" | "first_month";
    useConnect: boolean;
  },
): Promise<{ url: string }> {
  const prepared = await prepareCheckout(
    ctx,
    args.applicationId,
    args.clerkUserId,
    args.paymentType,
  );

  const stripe = requireStripe();
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    success_url: `${appUrl()}/applications/${args.applicationId}?checkout=success`,
    cancel_url: `${appUrl()}/applications/${args.applicationId}?checkout=canceled`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: prepared.amountCents,
          product_data: { name: args.productName },
        },
      },
    ],
    metadata: {
      applicationId: args.applicationId,
      paymentId: prepared.paymentId,
      type: args.paymentType,
      idempotencyKey: prepared.idempotencyKey,
    },
  };

  if (args.useConnect) {
    const destination = await ctx.runQuery(
      internal.payments.getConnectDestinationForApplication,
      { applicationId: args.applicationId },
    );
    if (!destination) {
      throw new Error("Landlord payouts are not configured for this listing");
    }
    sessionParams.payment_intent_data = {
      transfer_data: {
        destination: destination.stripeConnectAccountId,
      },
    };
    sessionParams.line_items = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: prepared.amountCents,
          product_data: {
            name: `${args.productName} — ${destination.listingTitle}`,
          },
        },
      },
    ];
  }

  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: prepared.idempotencyKey,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  await ctx.runMutation(internal.payments.markCheckoutOpen, {
    paymentId: prepared.paymentId,
    stripeCheckoutSessionId: session.id,
    applicationId: args.applicationId,
  });

  return { url: session.url };
}

export const createApplicationFeeCheckout = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await createCheckoutSession(ctx, {
      applicationId: args.applicationId,
      clerkUserId: identity.subject,
      productName: "RentaMart application fee",
      paymentType: "application_fee",
      useConnect: false,
    });
  },
});

export const createDepositCheckout = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await createCheckoutSession(ctx, {
      applicationId: args.applicationId,
      clerkUserId: identity.subject,
      productName: "RentaMart security deposit",
      paymentType: "deposit",
      useConnect: true,
    });
  },
});

export const createFirstMonthCheckout = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await createCheckoutSession(ctx, {
      applicationId: args.applicationId,
      clerkUserId: identity.subject,
      productName: "RentaMart first month rent",
      paymentType: "first_month",
      useConnect: true,
    });
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
    } else if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await ctx.runAction(internal.orgsActions.applyAccountUpdated, {
        stripeConnectAccountId: account.id,
        chargesEnabled: account.charges_enabled === true,
        payoutsEnabled: account.payouts_enabled === true,
        detailsSubmitted: account.details_submitted === true,
      });
      await ctx.runMutation(internal.payments.recordStripeEvent, {
        stripeEventId: event.id,
        type: event.type,
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
