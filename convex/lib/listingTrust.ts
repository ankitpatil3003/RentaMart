import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_MIN_APPROVED_FOR_FAST_PATH = 3;

export type OrgListingTrust = {
  eligible: boolean;
  approvedCount: number;
  deniedCount: number;
  connectReady: boolean;
  minApprovedRequired: number;
};

export function minApprovedForFastPath(): number {
  const raw = process.env.TRUSTED_ORG_MIN_APPROVED_LISTINGS;
  if (!raw) return DEFAULT_MIN_APPROVED_FOR_FAST_PATH;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_MIN_APPROVED_FOR_FAST_PATH;
  }
  return Math.floor(n);
}

function effectiveVerificationStatus(
  listing: Doc<"listings">,
): "draft" | "pending_review" | "approved" | "denied" {
  if (listing.verificationStatus) return listing.verificationStatus;
  return listing.published ? "approved" : "draft";
}

/**
 * Trusted-org fast-path: Connect ready, enough approved listings, and no
 * current denials (excluding an optional listing being re-submitted).
 */
export async function getOrgListingTrust(
  ctx: Ctx,
  orgId: Id<"orgs">,
  opts?: { excludeListingId?: Id<"listings"> },
): Promise<OrgListingTrust> {
  const org = await ctx.db.get(orgId);
  const connectReady = org?.connectReady === true;
  const minApprovedRequired = minApprovedForFastPath();

  const listings = await ctx.db
    .query("listings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();

  let approvedCount = 0;
  let deniedCount = 0;
  for (const listing of listings) {
    if (
      opts?.excludeListingId &&
      listing._id === opts.excludeListingId
    ) {
      continue;
    }
    const status = effectiveVerificationStatus(listing);
    if (status === "approved") approvedCount += 1;
    if (status === "denied") deniedCount += 1;
  }

  const eligible =
    connectReady &&
    deniedCount === 0 &&
    approvedCount >= minApprovedRequired;

  return {
    eligible,
    approvedCount,
    deniedCount,
    connectReady,
    minApprovedRequired,
  };
}
