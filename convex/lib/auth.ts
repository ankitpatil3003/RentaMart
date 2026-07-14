import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type OrgMemberRole = Doc<"orgMembers">["role"];

export async function getIdentityOrNull(ctx: Ctx) {
  return await ctx.auth.getUserIdentity();
}

export async function requireIdentity(ctx: Ctx) {
  const identity = await getIdentityOrNull(ctx);
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

export async function getCurrentUserOrNull(
  ctx: Ctx,
): Promise<Doc<"users"> | null> {
  const identity = await getIdentityOrNull(ctx);
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUserOrNull(ctx);
  if (!user) {
    throw new Error("User profile not found");
  }
  return user;
}

export function userHasRole(
  user: Doc<"users">,
  role: Doc<"users">["roles"][number],
): boolean {
  return user.roles.includes(role);
}

export async function requireOrgMember(
  ctx: Ctx,
  user: Doc<"users">,
  orgId: Id<"orgs">,
): Promise<Doc<"orgMembers">> {
  const membership = await ctx.db
    .query("orgMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("orgId", orgId).eq("userId", user._id),
    )
    .unique();
  if (!membership) {
    throw new Error("Not a member of this organization");
  }
  return membership;
}

export async function requireOrgRole(
  ctx: Ctx,
  user: Doc<"users">,
  orgId: Id<"orgs">,
  roles: OrgMemberRole[],
): Promise<Doc<"orgMembers">> {
  const membership = await requireOrgMember(ctx, user, orgId);
  if (!roles.includes(membership.role)) {
    throw new Error("Insufficient organization permissions");
  }
  return membership;
}
