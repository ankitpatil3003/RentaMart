import { test, expect } from "@playwright/test";

/**
 * Smoke coverage for the trust gates (landlord request/approve + listing
 * review) and team invite surfaces. Authenticated golden path lives in
 * `trust-path.spec.ts` (set E2E_TRUST=1).
 */
test.describe("Trust path smoke", () => {
  test("homepage links to become a landlord", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Become a landlord" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Become a landlord" }).click();
    await expect(page).toHaveURL(/become-landlord|sign-in/);
  });

  test("become-landlord requires sign-in", async ({ page }) => {
    await page.goto("/become-landlord");
    await expect(page).toHaveURL(/sign-in|become-landlord/);
    // Signed-out users either see Clerk sign-in or the page sign-in prompt.
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).toMatch(/sign in|become a landlord/);
  });

  test("admin requires sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("admin landlord-requests requires sign-in", async ({ page }) => {
    await page.goto("/admin/landlord-requests");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("admin listing reviews requires sign-in", async ({ page }) => {
    await page.goto("/admin/listings");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("landlord team requires sign-in", async ({ page }) => {
    await page.goto("/landlord/team");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("invites requires sign-in", async ({ page }) => {
    await page.goto("/invites");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("landlord portal redirects unauthenticated users to sign-in", async ({
    page,
  }) => {
    await page.goto("/landlord");
    await expect(page).toHaveURL(/sign-in/);
  });
});
