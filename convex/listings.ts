import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  requireOrgMember,
  requireOrgRole,
  requireUser,
} from "./lib/auth";
import { defaultApplicationFeeCents } from "./lib/money";

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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing || !listing.published) return null;
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
    await requireListingInOrg(ctx, args.orgId, args.listingId);

    const depositCents = args.depositCents ?? args.rentCents;
    const firstMonthCents = args.firstMonthCents ?? args.rentCents;

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
