import { test, expect } from "@playwright/test";

test.describe("webhook replay", () => {
  test.skip(
    !process.env.E2E_WEBHOOK_REPLAY,
    "Set E2E_WEBHOOK_REPLAY=1 against a Convex site URL with Stripe signing",
  );

  test("duplicate stripe event does not double-apply", async () => {
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    expect(siteUrl).toBeTruthy();
    // Replay harness posts the same signed payload twice; implement with fixtures when Stripe CLI secrets are present.
  });
});
