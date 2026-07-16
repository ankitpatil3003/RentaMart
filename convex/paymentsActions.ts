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
  stripeCheckoutSessionId?: string;
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

  // Include prior session id so retries after expiry create a new Checkout
  // session instead of Stripe returning the same expired one for 24h.
  const stripeIdempotencyKey = prepared.stripeCheckoutSessionId
    ? `${prepared.idempotencyKey}:${prepared.stripeCheckoutSessionId}`
    : `${prepared.idempotencyKey}:new`;

  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: stripeIdempotencyKey,
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

export const createRentCheckout = action({
  args: { rentChargeId: v.id("rentCharges") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const prepared = await ctx.runMutation(internal.payments.prepareRentCheckout, {
      rentChargeId: args.rentChargeId,
      clerkUserId: identity.subject,
    });

    const stripe = requireStripe();
    const destination = await ctx.runQuery(
      internal.payments.getConnectDestinationForApplication,
      { applicationId: prepared.applicationId },
    );
    if (!destination) {
      throw new Error("Landlord payouts are not configured for this listing");
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      success_url: `${appUrl()}/rent?checkout=success`,
      cancel_url: `${appUrl()}/rent?checkout=canceled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: prepared.amountCents,
            product_data: {
              name: `Monthly rent ${prepared.listingTitle}`,
            },
          },
        },
      ],
      metadata: {
        applicationId: prepared.applicationId,
        paymentId: prepared.paymentId,
        type: "rent",
        idempotencyKey: prepared.idempotencyKey,
      },
      payment_intent_data: {
        transfer_data: {
          destination: destination.stripeConnectAccountId,
        },
      },
    };

    const stripeIdempotencyKey = prepared.stripeCheckoutSessionId
      ? `${prepared.idempotencyKey}:${prepared.stripeCheckoutSessionId}`
      : `${prepared.idempotencyKey}:new`;

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: stripeIdempotencyKey,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    await ctx.runMutation(internal.payments.markCheckoutOpen, {
      paymentId: prepared.paymentId,
      stripeCheckoutSessionId: session.id,
      rentChargeId: prepared.rentChargeId,
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

export const syncCheckoutStatus = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({
    synced: v.boolean(),
    message: v.string(),
    paymentStatus: v.optional(v.string()),
    sessionStatus: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const openPayments = await ctx.runQuery(
      internal.payments.listOpenCheckoutsForSync,
      {
        applicationId: args.applicationId,
        clerkUserId: identity.subject,
      },
    );

    if (openPayments.length === 0) {
      return {
        synced: false,
        message: "No open checkout session found to sync.",
      };
    }

    const stripe = requireStripe();
    let lastMessage = "No update needed.";
    let synced = false;
    let paymentStatus: string | undefined;
    let sessionStatus: string | undefined;

    for (const payment of openPayments) {
      const session = await stripe.checkout.sessions.retrieve(
        payment.stripeCheckoutSessionId,
      );
      paymentStatus = session.payment_status;
      sessionStatus = session.status ?? undefined;

      if (session.payment_status === "paid") {
        await ctx.runMutation(internal.payments.applyStripeCheckoutEvent, {
          stripeEventId: `sync:${session.id}:paid`,
          type: "checkout.session.completed",
          sessionId: session.id,
          paymentStatus: session.payment_status,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          metadata: {
            applicationId: args.applicationId,
            paymentId: payment.paymentId,
            idempotencyKey: payment.idempotencyKey,
            type: payment.type,
          },
        });
        synced = true;
        lastMessage = "Payment confirmed. Application status updated.";
        continue;
      }

      if (session.status === "expired") {
        await ctx.runMutation(internal.payments.applyStripeCheckoutEvent, {
          stripeEventId: `sync:${session.id}:expired`,
          type: "checkout.session.expired",
          sessionId: session.id,
          paymentStatus: session.payment_status,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          metadata: {
            applicationId: args.applicationId,
            paymentId: payment.paymentId,
            idempotencyKey: payment.idempotencyKey,
            type: payment.type,
          },
        });
        synced = true;
        lastMessage =
          "Checkout session expired without payment. You can pay again.";
        continue;
      }

      lastMessage =
        "Checkout is still open or unpaid. Complete payment in Stripe, then refresh again.";
    }

    return {
      synced,
      message: lastMessage,
      paymentStatus,
      sessionStatus,
    };
  },
});

export const syncRentCheckoutStatus = action({
  args: {},
  returns: v.object({
    synced: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const openPayments = await ctx.runQuery(
      internal.payments.listOpenRentCheckoutsForSync,
      { clerkUserId: identity.subject },
    );

    if (openPayments.length === 0) {
      return {
        synced: false,
        message: "No open rent checkout session found to sync.",
      };
    }

    const stripe = requireStripe();
    let lastMessage = "No update needed.";
    let synced = false;

    for (const payment of openPayments) {
      const session = await stripe.checkout.sessions.retrieve(
        payment.stripeCheckoutSessionId,
      );

      if (session.payment_status === "paid") {
        await ctx.runMutation(internal.payments.applyStripeCheckoutEvent, {
          stripeEventId: `sync:${session.id}:paid`,
          type: "checkout.session.completed",
          sessionId: session.id,
          paymentStatus: session.payment_status,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          metadata: {
            applicationId: payment.applicationId,
            paymentId: payment.paymentId,
            idempotencyKey: payment.idempotencyKey,
            type: "rent",
          },
        });
        synced = true;
        lastMessage = "Rent payment confirmed.";
        continue;
      }

      if (session.status === "expired") {
        await ctx.runMutation(internal.payments.applyStripeCheckoutEvent, {
          stripeEventId: `sync:${session.id}:expired`,
          type: "checkout.session.expired",
          sessionId: session.id,
          paymentStatus: session.payment_status,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          metadata: {
            applicationId: payment.applicationId,
            paymentId: payment.paymentId,
            idempotencyKey: payment.idempotencyKey,
            type: "rent",
          },
        });
        synced = true;
        lastMessage = "Rent checkout expired. You can pay again.";
        continue;
      }

      lastMessage =
        "Checkout is still open or unpaid. Complete payment in Stripe, then refresh again.";
    }

    return { synced, message: lastMessage };
  },
});
