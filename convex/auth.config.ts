/**
 * Clerk JWT issuer for Convex auth.
 * Domain must match your Clerk Frontend API URL (JWT issuer).
 * Create a Clerk JWT template named `convex`.
 */
const authConfig = {
  providers: [
    {
      domain: "https://novel-skunk-34.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

export default authConfig;
