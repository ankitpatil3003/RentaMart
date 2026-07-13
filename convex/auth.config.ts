/**
 * Clerk JWT issuer for Convex auth.
 * Replace `domain` with your Clerk Frontend API URL (JWT issuer),
 * e.g. https://verb-noun-00.clerk.accounts.dev
 * Create a Clerk JWT template named `convex`.
 */
const authConfig = {
  providers: [
    {
      domain: "https://placeholder.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

export default authConfig;
