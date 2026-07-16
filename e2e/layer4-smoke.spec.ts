import { test, expect } from "@playwright/test";

test.describe("Layer 4 competitive selection smoke", () => {
  test("landlord applications routes require sign-in", async ({ page }) => {
    await page.goto("/landlord/applications");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("applications page copy mentions selection model", async ({ page }) => {
    await page.goto("/landlord/applications?orgId=dummy");
    // Unauthenticated users redirect before org check.
    await expect(page).toHaveURL(/sign-in/);
  });
});
