import { test, expect } from "@playwright/test";

/**
 * Full competitive selection path requires Clerk + Stripe Connect + two renter accounts.
 */
test.describe("Layer 4 golden path (requires secrets)", () => {
  test.skip(
    !process.env.E2E_LAYER4,
    "Set E2E_LAYER4=1 with Clerk/Stripe test credentials to run",
  );

  test("two applicants qualified landlord selects one refunds other", async ({
    page,
  }) => {
    await page.goto("/landlord/applications");
    await expect(
      page.getByRole("heading", { name: /applications/i }),
    ).toBeVisible();
    // Remaining steps: two renter storage states, Stripe Checkout, selectApplicant, refund assert.
  });
});
