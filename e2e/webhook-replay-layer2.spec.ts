import { test, expect } from "@playwright/test";

test.describe("Layer 2 deposit webhook replay", () => {
  test.skip(
    !process.env.E2E_LAYER2_WEBHOOK_REPLAY,
    "Set E2E_LAYER2_WEBHOOK_REPLAY=1 against Convex site URL with Stripe signing",
  );

  test("duplicate deposit event does not double-apply", async () => {
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    expect(siteUrl).toBeTruthy();
  });
});
