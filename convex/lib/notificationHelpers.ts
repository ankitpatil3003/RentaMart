import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

export type NotificationKind =
  | "application_fee_paid"
  | "approved_for_deposit"
  | "qualified"
  | "selected_tenant"
  | "not_selected"
  | "refund_completed"
  | "moved_in"
  | "denied"
  | "tenant_selected";

async function listingTitle(
  ctx: MutationCtx,
  listingId: Id<"listings">,
): Promise<string> {
  const listing = await ctx.db.get(listingId);
  return listing?.title ?? "Listing";
}

async function scheduleEmail(
  ctx: MutationCtx,
  notificationId: Id<"notifications">,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.emailActions.sendForNotification, {
    notificationId,
  });
}

export async function notifyRenter(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
  type: NotificationKind,
  title: string,
  body: string,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;

  const notificationId = await ctx.db.insert("notifications", {
    userId: application.renterUserId,
    applicationId,
    type,
    title,
    body,
    createdAt: Date.now(),
  });
  await scheduleEmail(ctx, notificationId);
}

export async function notifyOrgStaff(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  applicationId: Id<"applications">,
  type: NotificationKind,
  title: string,
  body: string,
): Promise<void> {
  const members = await ctx.db
    .query("orgMembers")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();

  for (const member of members) {
    const notificationId = await ctx.db.insert("notifications", {
      userId: member.userId,
      applicationId,
      orgId,
      type,
      title,
      body,
      createdAt: Date.now(),
    });
    await scheduleEmail(ctx, notificationId);
  }
}

export async function notifyApplicationFeePaid(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const listing = await ctx.db.get(application.listingId);
  if (!listing) return;
  const title = listing.title;

  await notifyOrgStaff(
    ctx,
    listing.orgId,
    applicationId,
    "application_fee_paid",
    "Application ready for review",
    `${application.fullName} paid the application fee for ${title}.`,
  );
}

export async function notifyQualified(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const listing = await ctx.db.get(application.listingId);
  if (!listing) return;
  const title = listing.title;

  await notifyRenter(
    ctx,
    applicationId,
    "qualified",
    "You are qualified",
    `You completed all required payments for ${title}. The landlord will select a tenant.`,
  );
  await notifyOrgStaff(
    ctx,
    listing.orgId,
    applicationId,
    "qualified",
    "Applicant qualified",
    `${application.fullName} is qualified for ${title} and ready for selection.`,
  );
}

export async function notifyApprovedForDeposit(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const title = await listingTitle(ctx, application.listingId);

  await notifyRenter(
    ctx,
    applicationId,
    "approved_for_deposit",
    "Approved for deposit",
    `You were approved for ${title}. Pay your security deposit to continue.`,
  );
}

export async function notifyDenied(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const title = await listingTitle(ctx, application.listingId);

  await notifyRenter(
    ctx,
    applicationId,
    "denied",
    "Application not approved",
    `Your application for ${title} was not approved. The application fee is non-refundable.`,
  );
}

export async function notifySelectedTenant(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const listing = await ctx.db.get(application.listingId);
  if (!listing) return;
  const title = listing.title;

  await notifyRenter(
    ctx,
    applicationId,
    "selected_tenant",
    "You were selected",
    `You were selected as the tenant for ${title}. You are move-in ready.`,
  );
  await notifyOrgStaff(
    ctx,
    listing.orgId,
    applicationId,
    "tenant_selected",
    "Tenant selected",
    `${application.fullName} was selected for ${title}.`,
  );
}

export async function notifyNotSelected(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const title = await listingTitle(ctx, application.listingId);

  await notifyRenter(
    ctx,
    applicationId,
    "not_selected",
    "Another applicant was selected",
    `Another applicant was selected for ${title}. Your deposit and/or first month will be refunded automatically.`,
  );
}

export async function notifyRefundCompleted(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const title = await listingTitle(ctx, application.listingId);

  await notifyRenter(
    ctx,
    applicationId,
    "refund_completed",
    "Refund completed",
    `Your deposit and/or first month for ${title} has been refunded.`,
  );
}

export async function notifyMovedIn(
  ctx: MutationCtx,
  applicationId: Id<"applications">,
): Promise<void> {
  const application = await ctx.db.get(applicationId);
  if (!application) return;
  const listing = await ctx.db.get(application.listingId);
  if (!listing) return;
  const title = listing.title;

  await notifyOrgStaff(
    ctx,
    listing.orgId,
    applicationId,
    "moved_in",
    "Tenant moved in",
    `${application.fullName} has moved in to ${title}.`,
  );
}
