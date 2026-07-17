import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  requireOrgMember,
  requireOrgRole,
  requirePlatformAdmin,
  requireUser,
} from "./lib/auth";
import { getOrgListingTrust } from "./lib/listingTrust";
import { defaultApplicationFeeCents } from "./lib/money";
import { listingVerificationStatus } from "./schema";

type VerificationStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "denied";

function effectiveVerificationStatus(
  listing: Doc<"listings">,
): VerificationStatus {
  if (listing.verificationStatus) return listing.verificationStatus;
  return listing.published ? "approved" : "draft";
}

const listingPublic = v.object({
  _id: v.id("listings"),
  title: v.string(),
  city: v.string(),
  state: v.string(),
  rentCents: v.number(),
  beds: v.number(),
  baths: v.number(),
  photoUrls: v.array(v.string()),
  applicationFeeCents: v.number(),
});

export const search = query({
  args: {
    city: v.optional(v.string()),
    maxRentCents: v.optional(v.number()),
    minBeds: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(listingPublic),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const city = args.city?.trim();
    const result = city
      ? await ctx.db
          .query("listings")
          .withIndex("by_city_published", (q) =>
            q.eq("city", city).eq("published", true),
          )
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("listings")
          .withIndex("by_published", (q) => q.eq("published", true))
          .paginate(args.paginationOpts);

    const page = result.page
      .filter((listing) =>
        args.maxRentCents === undefined
          ? true
          : listing.rentCents <= args.maxRentCents,
      )
      .filter((listing) =>
        args.minBeds === undefined ? true : listing.beds >= args.minBeds,
      )
      .map((listing) => ({
        _id: listing._id,
        title: listing.title,
        city: listing.city,
        state: listing.state,
        rentCents: listing.rentCents,
        beds: listing.beds,
        baths: listing.baths,
        photoUrls: listing.photoUrls,
        applicationFeeCents: listing.applicationFeeCents,
      }));

    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getById = query({
  args: { listingId: v.id("listings") },
  returns: v.union(
    v.object({
      _id: v.id("listings"),
      title: v.string(),
      description: v.string(),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
      rentCents: v.number(),
      beds: v.number(),
      baths: v.number(),
      photoUrls: v.array(v.string()),
      applicationFeeCents: v.number(),
      published: v.boolean(),
      isOwnOrgListing: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing || !listing.published) return null;

    let isOwnOrgListing = false;
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkUserId", (q) =>
          q.eq("clerkUserId", identity.subject),
        )
        .unique();
      if (user) {
        const membership = await ctx.db
          .query("orgMembers")
          .withIndex("by_org_and_user", (q) =>
            q.eq("orgId", listing.orgId).eq("userId", user._id),
          )
          .unique();
        isOwnOrgListing = Boolean(membership);
      }
    }

    return {
      _id: listing._id,
      title: listing.title,
      description: listing.description,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      rentCents: listing.rentCents,
      beds: listing.beds,
      baths: listing.baths,
      photoUrls: listing.photoUrls,
      applicationFeeCents: listing.applicationFeeCents,
      published: listing.published,
      isOwnOrgListing,
    };
  },
});

const landlordListing = v.object({
  _id: v.id("listings"),
  orgId: v.id("orgs"),
  title: v.string(),
  description: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  rentCents: v.number(),
  depositCents: v.number(),
  firstMonthCents: v.number(),
  beds: v.number(),
  baths: v.number(),
  photoUrls: v.array(v.string()),
  published: v.boolean(),
  applicationFeeCents: v.number(),
  verificationStatus: listingVerificationStatus,
  verificationNote: v.optional(v.string()),
});

const listingFields = {
  title: v.string(),
  description: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  rentCents: v.number(),
  depositCents: v.optional(v.number()),
  firstMonthCents: v.optional(v.number()),
  beds: v.number(),
  baths: v.number(),
  photoUrls: v.array(v.string()),
  applicationFeeCents: v.optional(v.number()),
};

function toLandlordListing(listing: Doc<"listings">) {
  return {
    _id: listing._id,
    orgId: listing.orgId,
    title: listing.title,
    description: listing.description,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    rentCents: listing.rentCents,
    depositCents: listing.depositCents,
    firstMonthCents: listing.firstMonthCents,
    beds: listing.beds,
    baths: listing.baths,
    photoUrls: listing.photoUrls,
    published: listing.published,
    applicationFeeCents: listing.applicationFeeCents,
    verificationStatus: effectiveVerificationStatus(listing),
    verificationNote: listing.verificationNote,
  };
}

async function requireListingInOrg(
  ctx: Parameters<typeof requireUser>[0],
  orgId: Id<"orgs">,
  listingId: Id<"listings">,
) {
  const listing = await ctx.db.get(listingId);
  if (!listing || listing.orgId !== orgId) {
    throw new Error("Listing not found");
  }
  return listing;
}

function assertListingFieldsComplete(listing: Doc<"listings">) {
  if (
    !listing.title.trim() ||
    !listing.city.trim() ||
    !listing.state.trim() ||
    !listing.zip.trim() ||
    listing.rentCents <= 0 ||
    listing.photoUrls.length < 1
  ) {
    throw new Error(
      "Listing needs title, rent, city, state, zip, and at least one photo",
    );
  }
}

export const listForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(landlordListing),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return listings.map(toLandlordListing);
  },
});

export const getForOrgEdit = query({
  args: { orgId: v.id("orgs"), listingId: v.id("listings") },
  returns: v.union(landlordListing, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    try {
      await requireOrgMember(ctx, user, args.orgId);
    } catch {
      return null;
    }
    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.orgId !== args.orgId) return null;
    return toLandlordListing(listing);
  },
});

export const createDraft = mutation({
  args: {
    orgId: v.id("orgs"),
    ...listingFields,
  },
  returns: v.id("listings"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const depositCents = args.depositCents ?? args.rentCents;
    const firstMonthCents = args.firstMonthCents ?? args.rentCents;

    return await ctx.db.insert("listings", {
      orgId: args.orgId,
      title: args.title.trim(),
      description: args.description.trim(),
      city: args.city.trim(),
      state: args.state.trim(),
      zip: args.zip.trim(),
      rentCents: args.rentCents,
      depositCents,
      firstMonthCents,
      beds: args.beds,
      baths: args.baths,
      photoUrls: args.photoUrls,
      published: false,
      applicationFeeCents:
        args.applicationFeeCents ?? defaultApplicationFeeCents(),
      verificationStatus: "draft",
    });
  },
});

export const update = mutation({
  args: {
    orgId: v.id("orgs"),
    listingId: v.id("listings"),
    ...listingFields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);
    const listing = await requireListingInOrg(
      ctx,
      args.orgId,
      args.listingId,
    );

    const depositCents = args.depositCents ?? args.rentCents;
    const firstMonthCents = args.firstMonthCents ?? args.rentCents;
    const status = effectiveVerificationStatus(listing);

    // Material edits while pending/denied/approved (unpublished) reset to draft.
    const resetVerification =
      !listing.published &&
      (status === "pending_review" ||
        status === "denied" ||
        status === "approved");

    await ctx.db.patch(args.listingId, {
      title: args.title.trim(),
      description: args.description.trim(),
      city: args.city.trim(),
      state: args.state.trim(),
      zip: args.zip.trim(),
      rentCents: args.rentCents,
      depositCents,
      firstMonthCents,
      beds: args.beds,
      baths: args.baths,
      photoUrls: args.photoUrls,
      applicationFeeCents:
        args.applicationFeeCents ?? defaultApplicationFeeCents(),
      ...(resetVerification
        ? { verificationStatus: "draft" as const, verificationNote: undefined }
        : {}),
    });
    return null;
  },
});

export const submitForVerification = mutation({
  args: { orgId: v.id("orgs"), listingId: v.id("listings") },
  returns: v.object({
    verificationStatus: listingVerificationStatus,
    autoApproved: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);
    const listing = await requireListingInOrg(
      ctx,
      args.orgId,
      args.listingId,
    );
    assertListingFieldsComplete(listing);
    const status = effectiveVerificationStatus(listing);
    if (status === "pending_review") {
      throw new Error("Listing is already pending review");
    }
    if (status === "approved" && listing.published) {
      throw new Error("Published listings cannot be re-submitted");
    }

    const trust = await getOrgListingTrust(ctx, args.orgId, {
      excludeListingId: args.listingId,
    });

    if (trust.eligible) {
      await ctx.db.patch(args.listingId, {
        verificationStatus: "approved",
        verificationNote: `Auto-approved: trusted organization (${trust.approvedCount} prior approved listings)`,
      });
      return { verificationStatus: "approved" as const, autoApproved: true };
    }

    await ctx.db.patch(args.listingId, {
      verificationStatus: "pending_review",
      verificationNote: undefined,
    });
    return {
      verificationStatus: "pending_review" as const,
      autoApproved: false,
    };
  },
});

export const listPendingVerification = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("listings"),
      orgId: v.id("orgs"),
      orgName: v.string(),
      title: v.string(),
      city: v.string(),
      state: v.string(),
      rentCents: v.number(),
      photoUrls: v.array(v.string()),
      verificationStatus: listingVerificationStatus,
    }),
  ),
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const pending = await ctx.db
      .query("listings")
      .withIndex("by_verificationStatus", (q) =>
        q.eq("verificationStatus", "pending_review"),
      )
      .collect();

    const rows = [];
    for (const listing of pending) {
      const org = await ctx.db.get(listing.orgId);
      rows.push({
        _id: listing._id,
        orgId: listing.orgId,
        orgName: org?.name ?? "Unknown org",
        title: listing.title,
        city: listing.city,
        state: listing.state,
        rentCents: listing.rentCents,
        photoUrls: listing.photoUrls,
        verificationStatus: "pending_review" as const,
      });
    }
    return rows;
  },
});

export const approveListing = mutation({
  args: {
    listingId: v.id("listings"),
    adminNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    if (effectiveVerificationStatus(listing) !== "pending_review") {
      throw new Error("Listing is not pending review");
    }
    await ctx.db.patch(args.listingId, {
      verificationStatus: "approved",
      verificationNote: args.adminNote?.trim() || undefined,
    });
    return null;
  },
});

export const denyListing = mutation({
  args: {
    listingId: v.id("listings"),
    adminNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    if (effectiveVerificationStatus(listing) !== "pending_review") {
      throw new Error("Listing is not pending review");
    }
    await ctx.db.patch(args.listingId, {
      verificationStatus: "denied",
      verificationNote: args.adminNote?.trim() || undefined,
      published: false,
    });
    return null;
  },
});

export const publish = mutation({
  args: { orgId: v.id("orgs"), listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, ["org_owner"]);
    const listing = await requireListingInOrg(ctx, args.orgId, args.listingId);
    const org = await ctx.db.get(args.orgId);
    if (!org?.connectReady) {
      throw new Error(
        "Stripe Connect onboarding must be complete before publishing",
      );
    }
    if (effectiveVerificationStatus(listing) !== "approved") {
      throw new Error(
        "Listing must be approved by platform review before publishing",
      );
    }
    assertListingFieldsComplete(listing);
    await ctx.db.patch(args.listingId, { published: true });
    return null;
  },
});

export const unpublish = mutation({
  args: { orgId: v.id("orgs"), listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, ["org_owner"]);
    await requireListingInOrg(ctx, args.orgId, args.listingId);
    await ctx.db.patch(args.listingId, { published: false });
    return null;
  },
});
