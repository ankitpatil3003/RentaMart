import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

/**
 * Project-based Clerk setup so CLERK_FAPI / testing token reach workers.
 * Skipped unless E2E_TRUST=1 (full trust-path suite).
 */
setup("clerkSetup", async () => {
  if (process.env.E2E_TRUST !== "1") {
    setup.skip();
    return;
  }

  process.env.CLERK_PUBLISHABLE_KEY ??=
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    throw new Error(
      "E2E_TRUST=1 requires CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (or CLERK_PUBLISHABLE_KEY)",
    );
  }

  await clerkSetup();
});
