import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireOrgMember, requireUser } from "./lib/auth";
import { rentIdempotencyKey } from "./lib/money";
import { rentChargeStatus } from "./schema";

const rentChargeRecord = v.object({
  _id: v.id("rentCharges"),
  leaseId: v.id("leases"),
  periodKey: v.string(),
  dueDate: v.number(),
  amountCents: v.number(),
  status: rentChargeStatus,
  listingTitle: v.string(),
});

function dueDateForPeriod(dueDayOfMonth: number, year: number, month: number) {
  const day = Math.min(dueDayOfMonth, 28);
  return Date.UTC(year, month - 1, day);
}

export async function ensureChargesForLeaseInternal(
  ctx: MutationCtx,
  leaseId: Id<"leases">,
  monthsAhead = 3,
) {
  const lease = await ctx.db.get(leaseId);
  if (!lease || lease.status !== "active") return;

  // First month was already collected as the move-in `first_month` payment.
  // Mark that period paid so rent schedule does not ask for it again.
  const applicationPayments = await ctx.db
    .query("payments")
    .withIndex("by_application", (q) =>
      q.eq("applicationId", lease.applicationId),
    )
    .collect();
  const firstMonthPaid = applicationPayments.some(
    (payment) => payment.type === "first_month" && payment.status === "succeeded",
  );

  const start = new Date(lease.startDate);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth() + 1;

  for (let i = 0; i < monthsAhead; i += 1) {
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const existing = await ctx.db
      .query("rentCharges")
      .withIndex("by_lease_and_period", (q) =>
        q.eq("leaseId", leaseId).eq("periodKey", periodKey),
      )
      .unique();

    const coveredByFirstMonth = i === 0 && firstMonthPaid;
    if (!existing) {
      await ctx.db.insert("rentCharges", {
        leaseId,
        periodKey,
        dueDate: dueDateForPeriod(lease.dueDayOfMonth, year, month),
        amountCents: lease.rentCents,
        status: coveredByFirstMonth ? "paid" : "due",
      });
    } else if (
      coveredByFirstMonth &&
      (existing.status === "due" || existing.status === "failed")
    ) {
      await ctx.db.patch(existing._id, { status: "paid" });
    }

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

export const ensureChargesForLease = internalMutation({
  args: { leaseId: v.id("leases") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureChargesForLeaseInternal(ctx, args.leaseId);
    return null;
  },
});

export const getChargeForCheckout = internalQuery({
  args: { rentChargeId: v.id("rentCharges"), clerkUserId: v.string() },
  returns: v.union(
    v.object({
      rentChargeId: v.id("rentCharges"),
      leaseId: v.id("leases"),
      applicationId: v.id("applications"),
      amountCents: v.number(),
      periodKey: v.string(),
      idempotencyKey: v.string(),
      listingTitle: v.string(),
      status: rentChargeStatus,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const charge = await ctx.db.get(args.rentChargeId);
    if (!charge || charge.status === "paid") return null;

    const lease = await ctx.db.get(charge.leaseId);
    if (!lease || lease.status !== "active") return null;

    const renter = await ctx.db.get(lease.renterUserId);
    if (!renter || renter.clerkUserId !== args.clerkUserId) return null;

    const listing = await ctx.db.get(lease.listingId);
    if (!listing) return null;

    return {
      rentChargeId: charge._id,
      leaseId: lease._id,
      applicationId: lease.applicationId,
      amountCents: charge.amountCents,
      periodKey: charge.periodKey,
      idempotencyKey: rentIdempotencyKey(lease._id, charge.periodKey),
      listingTitle: listing.title,
      status: charge.status,
    };
  },
});

export const markRentCheckoutOpen = internalMutation({
  args: {
    rentChargeId: v.id("rentCharges"),
    paymentId: v.id("payments"),
    stripeCheckoutSessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.rentChargeId, { status: "checkout_open" });
    await ctx.db.patch(args.paymentId, {
      status: "checkout_open",
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      rentChargeId: args.rentChargeId,
    });
    return null;
  },
});

export const applyRentPaymentSuccess = internalMutation({
  args: { rentChargeId: v.id("rentCharges"), paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.rentChargeId, { status: "paid" });
    return null;
  },
});

export const applyRentPaymentFailed = internalMutation({
  args: { rentChargeId: v.id("rentCharges") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const charge = await ctx.db.get(args.rentChargeId);
    if (charge && charge.status !== "paid") {
      await ctx.db.patch(args.rentChargeId, { status: "failed" });
    }
    return null;
  },
});

async function chargeWithListing(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  charge: {
    _id: Id<"rentCharges">;
    leaseId: Id<"leases">;
    periodKey: string;
    dueDate: number;
    amountCents: number;
    status: "due" | "checkout_open" | "paid" | "failed";
  },
) {
  const lease = await ctx.db.get(charge.leaseId);
  const listing = lease ? await ctx.db.get(lease.listingId) : null;
  return {
    _id: charge._id,
    leaseId: charge.leaseId,
    periodKey: charge.periodKey,
    dueDate: charge.dueDate,
    amountCents: charge.amountCents,
    status: charge.status,
    listingTitle: listing?.title ?? "Listing",
  };
}

export const listForRenter = query({
  args: {},
  returns: v.array(rentChargeRecord),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const leases = await ctx.db
      .query("leases")
      .withIndex("by_renter", (q) => q.eq("renterUserId", user._id))
      .collect();

    const charges = [];
    for (const lease of leases) {
      const rows = await ctx.db
        .query("rentCharges")
        .withIndex("by_lease", (q) => q.eq("leaseId", lease._id))
        .collect();
      for (const row of rows) {
        charges.push(await chargeWithListing(ctx, row));
      }
    }
    charges.sort((a, b) => a.dueDate - b.dueDate);
    return charges;
  },
});

export const listForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(
    v.object({
      ...rentChargeRecord.fields,
      renterName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const leases = await ctx.db
      .query("leases")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const charges = [];
    for (const lease of leases) {
      const renter = await ctx.db.get(lease.renterUserId);
      const rows = await ctx.db
        .query("rentCharges")
        .withIndex("by_lease", (q) => q.eq("leaseId", lease._id))
        .collect();
      for (const row of rows) {
        charges.push({
          ...(await chargeWithListing(ctx, row)),
          renterName: renter?.name ?? renter?.email ?? "Renter",
        });
      }
    }
    charges.sort((a, b) => a.dueDate - b.dueDate);
    return charges;
  },
});
