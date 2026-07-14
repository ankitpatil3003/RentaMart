import { test, expect } from "@playwright/test";

/**
 * Full search → apply → fee → webhook path requires Clerk + Stripe secrets.
 * This file documents the golden path assertions; enable when env is wired.
 */
test.describe("golden path (requires secrets)", () => {
  test.skip(
    !process.env.E2E_FULL,
    "Set E2E_FULL=1 with Clerk/Stripe test credentials to run",
  );

  test("search apply fee webhook", async ({ page }) => {
    await page.goto("/listings");
    await expect(page.getByRole("heading", { name: "Listings" })).toBeVisible();
    // Remaining steps depend on seeded data + signed-in Clerk storageState.
  });
});
