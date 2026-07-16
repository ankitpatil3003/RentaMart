import { test, expect } from "@playwright/test";

test.describe("Layer 3 tenant ops smoke", () => {
  test("protected tenant routes require sign-in", async ({ page }) => {
    for (const path of ["/messages", "/rent", "/maintenance", "/applications"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/sign-in/);
    }
  });

  test("landlord tenant ops routes require sign-in", async ({ page }) => {
    for (const path of [
      "/landlord/messages",
      "/landlord/rent",
      "/landlord/maintenance",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/sign-in/);
    }
  });
});
