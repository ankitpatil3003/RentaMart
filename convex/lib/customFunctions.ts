import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { requireUser } from "./auth";

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx, args) => {
    const user = await requireUser(ctx);
    return { ctx: { ...ctx, user }, args };
  },
});

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, args) => {
    const user = await requireUser(ctx);
    return { ctx: { ...ctx, user }, args };
  },
});

// Org-scoped wrappers: use requireUser + requireOrgMember / requireOrgRole
// from ./auth in orgs, listings, applications, and screening handlers.
