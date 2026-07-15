import { test, expect } from "@playwright/test";

test.describe("Layer 5 notifications smoke", () => {
  test("renter notifications require sign-in", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("landlord notifications require sign-in", async ({ page }) => {
    await page.goto("/landlord/notifications");
    await expect(page).toHaveURL(/sign-in/);
  });
});
