import { clerk } from "@clerk/testing/playwright";
import type { Browser, BrowserContext, Page } from "@playwright/test";

export async function signInAs(
  page: Page,
  emailAddress: string,
): Promise<void> {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress });
  // Ensure Convex ensureUser has a chance to run.
  await page.goto("/");
  await page.waitForTimeout(500);
}

export async function newSignedInContext(
  browser: Browser,
  emailAddress: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, emailAddress);
  return { context, page };
}

export async function getConvexAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(async () => {
    const clerk = (
      window as unknown as {
        Clerk?: {
          session?: {
            getToken: (opts: { template: string }) => Promise<string | null>;
          };
        };
      }
    ).Clerk;
    if (!clerk?.session) {
      throw new Error("Clerk session not available on page");
    }
    return await clerk.session.getToken({ template: "convex" });
  });
  if (!token) {
    throw new Error("Failed to get Clerk Convex JWT template token");
  }
  return token;
}

/** Minimal 1x1 PNG for landlord document upload. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
