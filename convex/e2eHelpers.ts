import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOrgMember, requireUser } from "./lib/auth";

function assertE2eModeEnabled() {
  if (process.env.E2E_MODE !== "true") {
    throw new Error(
      "E2E helpers are disabled. Set Convex env E2E_MODE=true on a non-production deployment only.",
    );
  }
}

/**
 * Marks an org Connect-ready so Playwright can finish publish without Stripe
 * onboarding. Gated by Convex env `E2E_MODE=true` (dev/demo only).
 */
export const markOrgConnectReady = mutation({
  args: { orgId: v.id("orgs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertE2eModeEnabled();
    const user = await requireUser(ctx);
    const membership = await requireOrgMember(ctx, user, args.orgId);
    if (membership.role !== "org_owner") {
      throw new Error("Only the organization owner can mark Connect ready");
    }
    const org = await ctx.db.get(args.orgId);
    if (!org) {
      throw new Error("Organization not found");
    }
    await ctx.db.patch(args.orgId, {
      connectReady: true,
      stripeConnectAccountId: org.stripeConnectAccountId ?? "acct_e2e_test",
    });
    return null;
  },
});
