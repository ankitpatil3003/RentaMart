import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireOrgMember,
  requireOrgRole,
  requireUser,
} from "./lib/auth";
import type { Id } from "./_generated/dataModel";

const screeningReport = v.object({
  _id: v.id("screeningReports"),
  applicationId: v.id("applications"),
  vendorRef: v.string(),
  status: v.union(
    v.literal("not_started"),
    v.literal("pending"),
    v.literal("complete"),
    v.literal("failed"),
  ),
  summary: v.optional(v.string()),
  missingDocs: v.array(v.string()),
  requestedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
});

async function requireApplicationInOrg(
  ctx: Parameters<typeof requireUser>[0],
  orgId: Id<"orgs">,
  applicationId: Id<"applications">,
) {
  const application = await ctx.db.get(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }
  const listing = await ctx.db.get(application.listingId);
  if (!listing || listing.orgId !== orgId) {
    throw new Error("Application not found");
  }
  return { application, listing };
}

export const requestStubScreening = mutation({
  args: { orgId: v.id("orgs"), applicationId: v.id("applications") },
  returns: v.id("screeningReports"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgRole(ctx, user, args.orgId, [
      "org_owner",
      "leasing_agent",
    ]);
    await requireApplicationInOrg(ctx, args.orgId, args.applicationId);

    const existing = await ctx.db
      .query("screeningReports")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .unique();
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("screeningReports", {
      applicationId: args.applicationId,
      vendorRef: `stub-${args.applicationId}`,
      status: "complete",
      summary:
        "Stub screening complete. Income and rental history look acceptable for manual review.",
      missingDocs: ["Government ID", "Recent pay stub"],
      requestedAt: now,
      completedAt: now,
    });
  },
});

export const getForApplication = query({
  args: { orgId: v.id("orgs"), applicationId: v.id("applications") },
  returns: v.union(screeningReport, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    try {
      await requireOrgMember(ctx, user, args.orgId);
    } catch {
      return null;
    }
    const application = await ctx.db.get(args.applicationId);
    if (!application) return null;
    const listing = await ctx.db.get(application.listingId);
    if (!listing || listing.orgId !== args.orgId) return null;
    const report = await ctx.db
      .query("screeningReports")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .unique();
    if (!report) return null;
    return {
      _id: report._id,
      applicationId: report.applicationId,
      vendorRef: report.vendorRef,
      status: report.status,
      summary: report.summary,
      missingDocs: report.missingDocs,
      requestedAt: report.requestedAt,
      completedAt: report.completedAt,
    };
  },
});
