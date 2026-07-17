import { ConvexHttpClient } from "convex/browser";
import type { Page } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getConvexAuthToken } from "./clerkAuth";

export async function markOrgConnectReadyViaApi(
  page: Page,
  orgId: Id<"orgs">,
): Promise<void> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required for trust-path E2E");
  }
  const token = await getConvexAuthToken(page);
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  await client.mutation(api.e2eHelpers.markOrgConnectReady, { orgId });
}

export function readOrgIdFromUrl(url: string): Id<"orgs"> | null {
  try {
    const parsed = new URL(url);
    const orgId = parsed.searchParams.get("orgId");
    return orgId as Id<"orgs"> | null;
  } catch {
    return null;
  }
}
