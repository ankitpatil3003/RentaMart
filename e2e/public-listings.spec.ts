import { test, expect } from "@playwright/test";

test.describe("public listings", () => {
  test("home brand and listings empty or seeded state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "RentaMart" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse listings" })).toBeVisible();

    await page.getByRole("link", { name: "Browse listings" }).click();
    await expect(page.getByRole("heading", { name: "Listings" })).toBeVisible();
    await expect(page.getByText(/No listings yet|bed/i).first()).toBeVisible();
  });
});
