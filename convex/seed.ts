import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser, userHasRole } from "./lib/auth";
import { defaultApplicationFeeCents } from "./lib/money";

const DEMO_ORG = "Demo Homes LLC";

const DEMO_LISTINGS = [
  {
    title: "Sunny 1BR near downtown Austin",
    description:
      "Bright one-bedroom with hardwood floors, in-unit laundry, and walkable cafes.",
    city: "Austin",
    state: "TX",
    zip: "78701",
    rentCents: 185000,
    beds: 1,
    baths: 1,
    photoUrls: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200",
    ],
  },
  {
    title: "Denver loft with mountain light",
    description:
      "Open loft layout, large windows, and a shared rooftop deck two blocks from transit.",
    city: "Denver",
    state: "CO",
    zip: "80202",
    rentCents: 220000,
    beds: 2,
    baths: 2,
    photoUrls: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200",
    ],
  },
  {
    title: "Brooklyn garden duplex",
    description:
      "Quiet duplex with a private garden, updated kitchen, and easy subway access.",
    city: "Brooklyn",
    state: "NY",
    zip: "11217",
    rentCents: 310000,
    beds: 2,
    baths: 1,
    photoUrls: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200",
    ],
  },
] as const;

export const demo = mutation({
  args: {},
  returns: v.object({
    orgId: v.id("orgs"),
    listingIds: v.array(v.id("listings")),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const allowUnauthSeed = process.env.SEED_ALLOW_UNAUTH === "true";
    if (!userHasRole(user, "platform_admin") && !allowUnauthSeed) {
      throw new Error("platform_admin role required to seed demo data");
    }

    let org = await ctx.db
      .query("orgs")
      .withIndex("by_name", (q) => q.eq("name", DEMO_ORG))
      .unique();
    if (!org) {
      const orgId = await ctx.db.insert("orgs", {
        name: DEMO_ORG,
        connectReady: false,
      });
      org = (await ctx.db.get(orgId))!;
    }

    const fee = defaultApplicationFeeCents();
    const listingIds = [];
    for (const listing of DEMO_LISTINGS) {
      const existing = (
        await ctx.db
          .query("listings")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .collect()
      ).find((row) => row.title === listing.title);
      if (existing) {
        listingIds.push(existing._id);
        continue;
      }
      const id = await ctx.db.insert("listings", {
        orgId: org._id,
        title: listing.title,
        description: listing.description,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        rentCents: listing.rentCents,
        beds: listing.beds,
        baths: listing.baths,
        photoUrls: [...listing.photoUrls],
        published: true,
        applicationFeeCents: fee,
      });
      listingIds.push(id);
    }

    return { orgId: org._id, listingIds };
  },
});

export const promoteSelfToPlatformAdmin = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (process.env.SEED_ALLOW_UNAUTH !== "true") {
      throw new Error("SEED_ALLOW_UNAUTH must be true for local bootstrap");
    }
    const user = await requireUser(ctx);
    if (!userHasRole(user, "platform_admin")) {
      await ctx.db.patch(user._id, {
        roles: [...user.roles, "platform_admin"],
      });
    }
    return null;
  },
});
