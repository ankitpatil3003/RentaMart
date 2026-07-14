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

export const createConnectOnboardingLink = action({
  args: { orgId: v.id("orgs") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const org = await ctx.runQuery(internal.orgs.getForConnectOnboarding, {
      orgId: args.orgId,
      clerkUserId: identity.subject,
    });
    if (!org) {
      throw new Error("Organization not found or unauthorized");
    }

    const stripe = requireStripe();
    let accountId = org.stripeConnectAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: org.name,
        },
      });
      accountId = account.id;
      await ctx.runMutation(internal.orgs.setConnectAccount, {
        orgId: args.orgId,
        stripeConnectAccountId: accountId,
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl()}/landlord/connect?orgId=${args.orgId}`,
      return_url: `${appUrl()}/landlord/connect?orgId=${args.orgId}&onboarded=1`,
      type: "account_onboarding",
    });
    if (!link.url) {
      throw new Error("Stripe did not return an onboarding URL");
    }
    return { url: link.url };
  },
});

export const syncConnectStatus = action({
  args: { orgId: v.id("orgs") },
  returns: v.object({ connectReady: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const org = await ctx.runQuery(internal.orgs.getForConnectOnboarding, {
      orgId: args.orgId,
      clerkUserId: identity.subject,
    });
    if (!org?.stripeConnectAccountId) {
      return { connectReady: false };
    }

    const stripe = requireStripe();
    const account = await stripe.accounts.retrieve(org.stripeConnectAccountId);
    const connectReady =
      account.charges_enabled === true &&
      account.payouts_enabled === true &&
      account.details_submitted === true;

    await ctx.runMutation(internal.orgs.setConnectReady, {
      orgId: args.orgId,
      connectReady,
    });
    return { connectReady };
  },
});

export const applyAccountUpdated = internalAction({
  args: {
    stripeConnectAccountId: v.string(),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.orgs.getOrgByStripeConnectAccountId, {
      stripeConnectAccountId: args.stripeConnectAccountId,
    });
    if (!org) return null;

    const connectReady =
      args.chargesEnabled && args.payoutsEnabled && args.detailsSubmitted;
    await ctx.runMutation(internal.orgs.setConnectReady, {
      orgId: org.orgId,
      connectReady,
    });
    return null;
  },
});
