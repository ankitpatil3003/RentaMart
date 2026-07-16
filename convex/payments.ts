import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireOrgMember, requireUser } from "./lib/auth";
import {
  notifyApplicationFeePaid,
  notifyQualified,
} from "./lib/notificationHelpers";
import {
  appFeeIdempotencyKey,
  depositIdempotencyKey,
  firstMonthIdempotencyKey,
  rentIdempotencyKey,
} from "./lib/money";
import { paymentStatus, paymentType } from "./schema";

const paymentRecord = v.object({
  _id: v.id("payments"),
  type: paymentType,
  status: paymentStatus,
  amountCents: v.number(),
  idempotencyKey: v.string(),
  stripeCheckoutSessionId: v.optional(v.string()),
});

export const getByApplication = query({
  args: { applicationId: v.id("applications") },
  returns: v.union(paymentRecord, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return null;
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

export const listForApplication = query({
  args: { applicationId: v.id("applications") },
  returns: v.array(paymentRecord),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.renterUserId !== user._id) {
      return [];
    }
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .collect();
    return payments.map((payment) => ({
      _id: payment._id,
      type: payment.type,
      status: payment.status,
      amountCents: payment.amountCents,
      idempotencyKey: payment.idempotencyKey,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
    }));
  },
});

export const getConnectDestinationForApplication = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.object({
      stripeConnectAccountId: v.string(),
      listingTitle: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) return null;
    const listing = await ctx.db.get(application.listingId);
    if (!listing) return null;
    const org = await ctx.db.get(listing.orgId);
    if (!org?.stripeConnectAccountId || !org.connectReady) return null;
    return {
      stripeConnectAccountId: org.stripeConnectAccountId,
      listingTitle: listing.title,
    };
  },
});

async function preparePaymentCheckout(
  ctx: MutationCtx,
  args: {
    applicationId: import("./_generated/dataModel").Id<"applications">;
    clerkUserId: string;
    type: "application_fee" | "deposit" | "first_month";
    allowedStatuses: Array<
      | "submitted"
      | "fee_pending"
      | "fee_failed"
      | "deposit_due"
      | "first_month_due"
    >;
    idempotencyKey: string;
    amountCents: number;
    alreadyPaidMessage: string;
    notReadyMessage: string;
  },
) {
  const application = await ctx.db.get(args.applicationId);
  if (!application) throw new Error("Application not found");
  const user = await ctx.db.get(application.renterUserId);
  if (!user || user.clerkUserId !== args.clerkUserId) {
    throw new Error("Unauthorized");
  }
  if (!args.allowedStatuses.includes(application.status as never)) {
    throw new Error(args.notReadyMessage);
  }

  const existing = await ctx.db
    .query("payments")
    .withIndex("by_idempotencyKey", (q) =>
      q.eq("idempotencyKey", args.idempotencyKey),
    )
    .unique();
  if (existing?.status === "succeeded") {
    throw new Error(args.alreadyPaidMessage);
  }
  if (existing) {
    return {
      paymentId: existing._id,
      amountCents: existing.amountCents,
      idempotencyKey: existing.idempotencyKey,
      stripeCheckoutSessionId: existing.stripeCheckoutSessionId,
    };
  }

  const paymentId = await ctx.db.insert("payments", {
    applicationId: args.applicationId,
    type: args.type,
    status: "created",
    amountCents: args.amountCents,
    currency: "usd",
    idempotencyKey: args.idempotencyKey,
  });
  return {
    paymentId,
    amountCents: args.amountCents,
    idempotencyKey: args.idempotencyKey,
    stripeCheckoutSessionId: undefined,
  };
}

export const prepareApplicationFeeCheckout = internalMutation({
  args: { applicationId: v.id("applications"), clerkUserId: v.string() },
  returns: v.object({
    paymentId: v.id("payments"),
    amountCents: v.number(),
    idempotencyKey: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found");
    const listing = await ctx.db.get(application.listingId);
    if (!listing) throw new Error("Listing not found");

    return await preparePaymentCheckout(ctx, {
      applicationId: args.applicationId,
      clerkUserId: args.clerkUserId,
      type: "application_fee",
      allowedStatuses: ["submitted", "fee_pending", "fee_failed"],
      idempotencyKey: appFeeIdempotencyKey(args.applicationId),
      amountCents: listing.applicationFeeCents,
      alreadyPaidMessage: "Application fee already paid",
      notReadyMessage: "Application is not ready for fee payment",
    });
  },
});

export const prepareDepositCheckout = internalMutation({
  args: { applicationId: v.id("applications"), clerkUserId: v.string() },
  returns: v.object({
    paymentId: v.id("payments"),
    amountCents: v.number(),
    idempotencyKey: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found");
    const listing = await ctx.db.get(application.listingId);
    if (!listing) throw new Error("Listing not found");

    return await preparePaymentCheckout(ctx, {
      applicationId: args.applicationId,
      clerkUserId: args.clerkUserId,
      type: "deposit",
      allowedStatuses: ["deposit_due"],
      idempotencyKey: depositIdempotencyKey(args.applicationId),
      amountCents: listing.depositCents,
      alreadyPaidMessage: "Deposit already paid",
      notReadyMessage: "Deposit is not due for this application",
    });
  },
});

export const prepareFirstMonthCheckout = internalMutation({
  args: { applicationId: v.id("applications"), clerkUserId: v.string() },
  returns: v.object({
    paymentId: v.id("payments"),
    amountCents: v.number(),
    idempotencyKey: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found");
    const listing = await ctx.db.get(application.listingId);
    if (!listing) throw new Error("Listing not found");

    return await preparePaymentCheckout(ctx, {
      applicationId: args.applicationId,
      clerkUserId: args.clerkUserId,
      type: "first_month",
      allowedStatuses: ["first_month_due"],
      idempotencyKey: firstMonthIdempotencyKey(args.applicationId),
      amountCents: listing.firstMonthCents,
      alreadyPaidMessage: "First month rent already paid",
      notReadyMessage: "First month rent is not due for this application",
    });
  },
});

export const prepareRentCheckout = internalMutation({
  args: {
    rentChargeId: v.id("rentCharges"),
    clerkUserId: v.string(),
  },
  returns: v.object({
    paymentId: v.id("payments"),
    applicationId: v.id("applications"),
    amountCents: v.number(),
    idempotencyKey: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
    listingTitle: v.string(),
    rentChargeId: v.id("rentCharges"),
  }),
  handler: async (ctx, args) => {
    const charge = await ctx.db.get(args.rentChargeId);
    if (!charge) {
      throw new Error("Rent charge not found");
    }
    if (charge.status === "paid") {
      throw new Error("Rent for this period is already paid");
    }
    if (charge.status !== "due" && charge.status !== "failed") {
      // checkout_open may retry below via existing payment row
      if (charge.status !== "checkout_open") {
        throw new Error("Rent charge is not payable");
      }
    }

    const lease = await ctx.db.get(charge.leaseId);
    if (!lease || lease.status !== "active") {
      throw new Error("Lease not found");
    }

    const renter = await ctx.db.get(lease.renterUserId);
    if (!renter || renter.clerkUserId !== args.clerkUserId) {
      throw new Error("Unauthorized");
    }

    const listing = await ctx.db.get(lease.listingId);
    if (!listing) throw new Error("Listing not found");

    // Move-in first_month payment already covers the lease start period.
    const start = new Date(lease.startDate);
    const startPeriodKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
    if (charge.periodKey === startPeriodKey) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_application", (q) =>
          q.eq("applicationId", lease.applicationId),
        )
        .collect();
      const firstMonthPaid = payments.some(
        (payment) =>
          payment.type === "first_month" && payment.status === "succeeded",
      );
      if (firstMonthPaid) {
        await ctx.db.patch(charge._id, { status: "paid" });
        throw new Error(
          "First month rent was already paid during move-in",
        );
      }
    }

    const idempotencyKey = rentIdempotencyKey(lease._id, charge.periodKey);
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_idempotencyKey", (q) =>
        q.eq("idempotencyKey", idempotencyKey),
      )
      .unique();

    if (existing?.status === "succeeded") {
      await ctx.db.patch(charge._id, { status: "paid" });
      throw new Error("Rent for this period is already paid");
    }

    if (existing) {
      return {
        paymentId: existing._id,
        applicationId: lease.applicationId,
        amountCents: existing.amountCents,
        idempotencyKey: existing.idempotencyKey,
        stripeCheckoutSessionId: existing.stripeCheckoutSessionId,
        listingTitle: listing.title,
        rentChargeId: charge._id,
      };
    }

    const paymentId = await ctx.db.insert("payments", {
      applicationId: lease.applicationId,
      type: "rent",
      status: "created",
      amountCents: charge.amountCents,
      currency: "usd",
      idempotencyKey,
      rentChargeId: charge._id,
    });

    return {
      paymentId,
      applicationId: lease.applicationId,
      amountCents: charge.amountCents,
      idempotencyKey,
      stripeCheckoutSessionId: undefined,
      listingTitle: listing.title,
      rentChargeId: charge._id,
    };
  },
});

export const markCheckoutOpen = internalMutation({
  args: {
    paymentId: v.id("payments"),
    applicationId: v.optional(v.id("applications")),
    stripeCheckoutSessionId: v.string(),
    rentChargeId: v.optional(v.id("rentCharges")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");

    await ctx.db.patch(args.paymentId, {
      status: "checkout_open",
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
    });

    if (args.rentChargeId) {
      await ctx.db.patch(args.rentChargeId, { status: "checkout_open" });
      return null;
    }

    if (!args.applicationId) return null;

    const application = await ctx.db.get(args.applicationId);
    if (!application) return null;

    if (
      payment.type === "application_fee" &&
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

export const listOpenCheckoutsForSync = internalQuery({
  args: {
    applicationId: v.id("applications"),
    clerkUserId: v.string(),
  },
  returns: v.array(
    v.object({
      paymentId: v.id("payments"),
      type: paymentType,
      status: paymentStatus,
      stripeCheckoutSessionId: v.string(),
      idempotencyKey: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) return [];
    const user = await ctx.db.get(application.renterUserId);
    if (!user || user.clerkUserId !== args.clerkUserId) return [];

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .collect();

    return payments
      .filter(
        (payment) =>
          payment.stripeCheckoutSessionId &&
          (payment.status === "checkout_open" ||
            payment.status === "created" ||
            payment.status === "failed"),
      )
      .map((payment) => ({
        paymentId: payment._id,
        type: payment.type,
        status: payment.status,
        stripeCheckoutSessionId: payment.stripeCheckoutSessionId!,
        idempotencyKey: payment.idempotencyKey,
      }));
  },
});

export const listOpenRentCheckoutsForSync = internalQuery({
  args: { clerkUserId: v.string() },
  returns: v.array(
    v.object({
      paymentId: v.id("payments"),
      rentChargeId: v.id("rentCharges"),
      applicationId: v.id("applications"),
      stripeCheckoutSessionId: v.string(),
      idempotencyKey: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) return [];

    const leases = await ctx.db
      .query("leases")
      .withIndex("by_renter", (q) => q.eq("renterUserId", user._id))
      .collect();

    const open = [];
    for (const lease of leases) {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_application", (q) =>
          q.eq("applicationId", lease.applicationId),
        )
        .collect();

      for (const payment of payments) {
        if (
          payment.type !== "rent" ||
          !payment.rentChargeId ||
          !payment.stripeCheckoutSessionId
        ) {
          continue;
        }
        if (
          payment.status === "checkout_open" ||
          payment.status === "created" ||
          payment.status === "failed"
        ) {
          open.push({
            paymentId: payment._id,
            rentChargeId: payment.rentChargeId,
            applicationId: lease.applicationId,
            stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
            idempotencyKey: payment.idempotencyKey,
          });
        }
      }
    }
    return open;
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

function nextApplicationStatusOnPaymentSuccess(
  paymentType: "application_fee" | "deposit" | "first_month" | "rent",
): "under_review" | "first_month_due" | "qualified" | null {
  switch (paymentType) {
    case "application_fee":
      return "under_review";
    case "deposit":
      return "first_month_due";
    case "first_month":
      return "qualified";
    case "rent":
      return null;
    default:
      return null;
  }
}

export const listForApplicationOrg = query({
  args: {
    orgId: v.id("orgs"),
    applicationId: v.id("applications"),
  },
  returns: v.array(paymentRecord),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    try {
      await requireOrgMember(ctx, user, args.orgId);
    } catch {
      return [];
    }
    const application = await ctx.db.get(args.applicationId);
    if (!application) return [];
    const listing = await ctx.db.get(application.listingId);
    if (!listing || listing.orgId !== args.orgId) return [];

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .collect();
    return payments.map((payment) => ({
      _id: payment._id,
      type: payment.type,
      status: payment.status,
      amountCents: payment.amountCents,
      idempotencyKey: payment.idempotencyKey,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
    }));
  },
});

export const getRefundablePayments = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.array(
    v.object({
      paymentId: v.id("payments"),
      type: v.union(v.literal("deposit"), v.literal("first_month")),
      amountCents: v.number(),
      stripePaymentIntentId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .collect();

    const refundable = [];
    for (const payment of payments) {
      if (
        (payment.type === "deposit" || payment.type === "first_month") &&
        payment.status === "succeeded" &&
        payment.stripePaymentIntentId
      ) {
        const existingRefund = await ctx.db
          .query("refunds")
          .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
          .first();
        if (existingRefund?.status === "succeeded") continue;

        refundable.push({
          paymentId: payment._id,
          type: payment.type,
          amountCents: payment.amountCents,
          stripePaymentIntentId: payment.stripePaymentIntentId,
        });
      }
    }
    return refundable;
  },
});

export const markPaymentRefunded = internalMutation({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, { status: "refunded" });
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
      if (payment.type === "rent" && payment.rentChargeId) {
        await ctx.db.patch(payment.rentChargeId, { status: "paid" });
      } else {
        const nextStatus = nextApplicationStatusOnPaymentSuccess(payment.type);
        if (nextStatus) {
          await ctx.db.patch(payment.applicationId, { status: nextStatus });
          if (nextStatus === "under_review") {
            await notifyApplicationFeePaid(ctx, payment.applicationId);
          } else if (nextStatus === "qualified") {
            await notifyQualified(ctx, payment.applicationId);
          }
        }
      }
    } else if (failed) {
      await ctx.db.patch(payment._id, {
        status: "failed",
        stripeEventId: args.stripeEventId,
        stripeCheckoutSessionId: args.sessionId,
      });
      if (payment.type === "rent" && payment.rentChargeId) {
        const charge = await ctx.db.get(payment.rentChargeId);
        if (charge && charge.status !== "paid") {
          await ctx.db.patch(payment.rentChargeId, { status: "failed" });
        }
      }
      const application = await ctx.db.get(payment.applicationId);
      if (
        payment.type === "application_fee" &&
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
