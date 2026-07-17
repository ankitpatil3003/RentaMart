import { test, expect } from "@playwright/test";
import {
  TINY_PNG,
  newSignedInContext,
} from "./helpers/clerkAuth";
import {
  markOrgConnectReadyViaApi,
  readOrgIdFromUrl,
} from "./helpers/convexE2E";

const trustEnabled = process.env.E2E_TRUST === "1";
const applicantEmail = process.env.E2E_CLERK_APPLICANT_EMAIL;
const adminEmail = process.env.E2E_CLERK_ADMIN_EMAIL;

/**
 * Authenticated golden path for landlord trust gates:
 * become-landlord → admin approve → listing submit → admin approve → publish.
 *
 * Requires:
 * - E2E_TRUST=1
 * - Clerk keys + E2E_CLERK_APPLICANT_EMAIL + E2E_CLERK_ADMIN_EMAIL
 * - NEXT_PUBLIC_CONVEX_URL pointing at a deployment with E2E_MODE=true
 * - Admin user promoted to platform_admin in Convex
 */
test.describe("Trust path golden (authenticated)", () => {
  test.skip(
    !trustEnabled || !applicantEmail || !adminEmail,
    "Set E2E_TRUST=1 with E2E_CLERK_APPLICANT_EMAIL and E2E_CLERK_ADMIN_EMAIL",
  );

  test("request approve listing review publish", async ({ browser }) => {
    const stamp = Date.now();
    const orgName = `E2E Trust Org ${stamp}`;
    const listingTitle = `E2E Trust Listing ${stamp}`;

    const applicant = await newSignedInContext(browser, applicantEmail!);
    const admin = await newSignedInContext(browser, adminEmail!);

    try {
      // --- Applicant: request landlord access (or continue if already member) ---
      await applicant.page.goto("/become-landlord");
      await expect(
        applicant.page.getByRole("heading", { name: /become a landlord/i }),
      ).toBeVisible({ timeout: 30_000 });

      const alreadyMember = await applicant.page
        .getByText(/already have landlord access/i)
        .isVisible()
        .catch(() => false);
      const alreadyApproved = await applicant.page
        .getByText(/landlord request was approved/i)
        .isVisible()
        .catch(() => false);
      const pending = await applicant.page
        .getByText(/request pending review/i)
        .isVisible()
        .catch(() => false);

      if (!alreadyMember && !alreadyApproved && !pending) {
        await applicant.page
          .getByLabel(/organization \/ business name/i)
          .fill(orgName);
        await applicant.page.setInputFiles('input[type="file"]', {
          name: "ownership.png",
          mimeType: "image/png",
          buffer: TINY_PNG,
        });
        await applicant.page
          .getByRole("button", { name: /request landlord access/i })
          .click();
        await expect(
          applicant.page.getByText(/request pending review/i),
        ).toBeVisible({ timeout: 30_000 });
      }

      // --- Admin: approve pending landlord request if present ---
      await admin.page.goto("/admin/landlord-requests");
      await expect(
        admin.page.getByRole("heading", { name: /landlord requests/i }),
      ).toBeVisible({ timeout: 30_000 });

      const approveLandlord = admin.page.getByRole("button", {
        name: /^Approve$/i,
      });
      if (await approveLandlord.first().isVisible().catch(() => false)) {
        const orgCard = admin.page
          .locator("article")
          .filter({ hasText: orgName });
        if ((await orgCard.count()) > 0) {
          await orgCard.getByRole("button", { name: /^Approve$/i }).click();
          await expect(orgCard).toHaveCount(0, { timeout: 30_000 });
        } else {
          await approveLandlord.first().click();
          await expect(
            admin.page.getByText(/no pending landlord requests/i),
          ).toBeVisible({ timeout: 30_000 });
        }
      }

      // --- Applicant: open portal, create listing, submit for review ---
      await applicant.page.goto("/become-landlord");
      const openPortal = applicant.page.getByRole("link", {
        name: /open landlord portal/i,
      });
      if (await openPortal.isVisible().catch(() => false)) {
        await openPortal.click();
      } else {
        await applicant.page.goto("/landlord");
      }
      await expect(
        applicant.page.getByRole("heading", { name: /landlord portal/i }),
      ).toBeVisible({ timeout: 30_000 });

      await applicant.page.getByRole("link", { name: /^Listings$/i }).click();
      await applicant.page.getByRole("link", { name: /new draft/i }).click();
      await expect(
        applicant.page.getByRole("heading", { name: /new listing draft/i }),
      ).toBeVisible({ timeout: 15_000 });

      await applicant.page.getByLabel(/^Title$/i).fill(listingTitle);
      await applicant.page
        .getByLabel(/^Description$/i)
        .fill("E2E trust-path listing for authenticity review.");
      await applicant.page.getByLabel(/^City$/i).fill("Austin");
      await applicant.page.getByLabel(/^State$/i).fill("TX");
      await applicant.page.getByLabel(/^ZIP$/i).fill("78701");
      await applicant.page.getByLabel(/monthly rent/i).fill("1800");
      await applicant.page
        .getByRole("button", { name: /create draft/i })
        .click();

      await expect(applicant.page).toHaveURL(/\/landlord\/listings\/.+\/edit/, {
        timeout: 30_000,
      });
      await expect(
        applicant.page.getByText(/verification:\s*draft/i),
      ).toBeVisible();

      await applicant.page
        .getByRole("button", { name: /submit for review/i })
        .click();
      await expect(
        applicant.page.getByText(/waiting for platform authenticity review/i),
      ).toBeVisible({ timeout: 30_000 });

      // --- Admin: approve listing authenticity ---
      await admin.page.goto("/admin/listings");
      await expect(
        admin.page.getByRole("heading", { name: /listing authenticity/i }),
      ).toBeVisible({ timeout: 30_000 });

      const listingCard = admin.page
        .locator("article")
        .filter({ hasText: listingTitle });
      await expect(listingCard).toBeVisible({ timeout: 30_000 });
      await listingCard
        .getByRole("button", { name: /approve listing/i })
        .click();
      await expect(listingCard).toHaveCount(0, { timeout: 30_000 });

      // --- Applicant: mark Connect ready (E2E helper) + publish ---
      await applicant.page.reload();
      await expect(
        applicant.page.getByText(/verification:\s*approved for publish/i),
      ).toBeVisible({ timeout: 30_000 });

      const orgId = readOrgIdFromUrl(applicant.page.url());
      expect(orgId).toBeTruthy();
      await markOrgConnectReadyViaApi(applicant.page, orgId!);
      await applicant.page.reload();

      await applicant.page.getByRole("button", { name: /^Publish$/i }).click();
      await expect(
        applicant.page.getByText(/this listing is published/i),
      ).toBeVisible({ timeout: 30_000 });

      // Public catalog shows the listing
      await applicant.page.goto("/listings");
      await expect(
        applicant.page.getByRole("link", { name: listingTitle }),
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await applicant.context.close();
      await admin.context.close();
    }
  });
});
