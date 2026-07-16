import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireOrgMember, requireUser } from "./lib/auth";

const threadSummary = v.object({
  _id: v.id("messageThreads"),
  applicationId: v.id("applications"),
  orgId: v.id("orgs"),
  listingTitle: v.string(),
  lastMessageAt: v.optional(v.number()),
  preview: v.optional(v.string()),
});

const messageRecord = v.object({
  _id: v.id("messages"),
  senderUserId: v.id("users"),
  senderName: v.string(),
  body: v.string(),
  createdAt: v.number(),
  isMine: v.boolean(),
});

const MESSAGING_STATUSES = new Set([
  "submitted",
  "fee_pending",
  "fee_paid",
  "fee_failed",
  "under_review",
  "approved",
  "deposit_due",
  "deposit_paid",
  "first_month_due",
  "first_month_paid",
  "qualified",
  "move_in_ready",
  "refund_eligible",
  "refunded",
  "moved",
  "denied",
]);

async function requireMessagingApplication(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  applicationId: Id<"applications">,
) {
  const application = await ctx.db.get(applicationId);
  if (!application) throw new Error("Application not found");
  if (!MESSAGING_STATUSES.has(application.status)) {
    throw new Error("Messaging is not available for this application");
  }
  const listing = await ctx.db.get(application.listingId);
  if (!listing) throw new Error("Listing not found");
  return { application, listing };
}

async function getOrCreateThreadRecord(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  applicationId: Id<"applications">,
) {
  const existing = await ctx.db
    .query("messageThreads")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .unique();
  if (existing) return existing;

  const { application, listing } = await requireMessagingApplication(
    ctx,
    applicationId,
  );
  const threadId = await ctx.db.insert("messageThreads", {
    applicationId,
    orgId: listing.orgId,
    renterUserId: application.renterUserId,
  });
  const thread = await ctx.db.get(threadId);
  if (!thread) throw new Error("Could not create message thread");
  return thread;
}

async function threadSummaryFromDoc(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  thread: {
    _id: Id<"messageThreads">;
    applicationId: Id<"applications">;
    orgId: Id<"orgs">;
    lastMessageAt?: number;
  },
) {
  const application = await ctx.db.get(thread.applicationId);
  const listing = application
    ? await ctx.db.get(application.listingId)
    : null;
  const latest = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .first();

  return {
    _id: thread._id,
    applicationId: thread.applicationId,
    orgId: thread.orgId,
    listingTitle: listing?.title ?? "Listing",
    lastMessageAt: thread.lastMessageAt,
    preview: latest?.body,
  };
}

export const listThreadsForRenter = query({
  args: {},
  returns: v.array(threadSummary),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const threads = await ctx.db
      .query("messageThreads")
      .withIndex("by_renter", (q) => q.eq("renterUserId", user._id))
      .collect();

    const summaries = [];
    for (const thread of threads) {
      summaries.push(await threadSummaryFromDoc(ctx, thread));
    }
    summaries.sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
    );
    return summaries;
  },
});

export const listThreadsForOrg = query({
  args: { orgId: v.id("orgs") },
  returns: v.array(
    v.object({
      ...threadSummary.fields,
      renterName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOrgMember(ctx, user, args.orgId);

    const threads = await ctx.db
      .query("messageThreads")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const summaries = [];
    for (const thread of threads) {
      const base = await threadSummaryFromDoc(ctx, thread);
      const renter = await ctx.db.get(thread.renterUserId);
      summaries.push({
        ...base,
        renterName: renter?.name ?? renter?.email ?? "Renter",
      });
    }
    summaries.sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
    );
    return summaries;
  },
});

export const listMessages = query({
  args: { applicationId: v.id("applications") },
  returns: v.object({
    threadId: v.optional(v.id("messageThreads")),
    messages: v.array(messageRecord),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { messages: [] };
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return { messages: [] };

    const { application, listing } = await requireMessagingApplication(
      ctx,
      args.applicationId,
    );

    const isRenter = application.renterUserId === user._id;
    const isOrgMember = !isRenter
      ? Boolean(
          await ctx.db
            .query("orgMembers")
            .withIndex("by_org_and_user", (q) =>
              q.eq("orgId", listing.orgId).eq("userId", user._id),
            )
            .unique(),
        )
      : false;

    if (!isRenter && !isOrgMember) {
      return { messages: [] };
    }

    const thread = await ctx.db
      .query("messageThreads")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .unique();

    if (!thread) {
      return { messages: [] };
    }

    const rows = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .collect();

    const messages = [];
    for (const row of rows) {
      const sender = await ctx.db.get(row.senderUserId);
      messages.push({
        _id: row._id,
        senderUserId: row.senderUserId,
        senderName: sender?.name ?? sender?.email ?? "User",
        body: row.body,
        createdAt: row.createdAt,
        isMine: row.senderUserId === user._id,
      });
    }

    return { threadId: thread._id, messages };
  },
});

export const send = mutation({
  args: {
    applicationId: v.id("applications"),
    body: v.string(),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const trimmed = args.body.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (trimmed.length > 4000) {
      throw new Error("Message is too long");
    }

    const user = await requireUser(ctx);
    const { application, listing } = await requireMessagingApplication(
      ctx,
      args.applicationId,
    );

    const isRenter = application.renterUserId === user._id;
    if (!isRenter) {
      await requireOrgMember(ctx, user, listing.orgId);
    }

    const thread = await getOrCreateThreadRecord(ctx, args.applicationId);
    const messageId = await ctx.db.insert("messages", {
      threadId: thread._id,
      senderUserId: user._id,
      body: trimmed,
      createdAt: Date.now(),
    });
    await ctx.db.patch(thread._id, { lastMessageAt: Date.now() });
    return messageId;
  },
});
