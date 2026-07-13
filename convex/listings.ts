import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

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
