# RentaMart Layer 6 (CI + Vercel Demo)

> **Goal:** Gate every PR with typecheck and (when secrets exist) Playwright smoke; document Vercel + Convex production deploy for a live demo.

**Builds on:** v1.0.0 on `main` / `develop`

**Out of scope:** Production Stripe live mode, custom domain DNS beyond Vercel docs, mobile apps.

---

## Implementation

- [x] `.github/workflows/ci.yml` — typecheck, Next.js build, Playwright smoke (secrets-gated)
- [x] `vercel.json` — Next.js install/build defaults
- [x] `npm run test:e2e:smoke` — public + layer 3/4/5 auth smoke only
- [x] README: Deploy + CI secrets section
- [x] This plan

## GitHub secrets for CI e2e

| Secret | Required for |
| ------ | ------------ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Playwright smoke job |
| `CLERK_SECRET_KEY` | Playwright smoke job |
| `NEXT_PUBLIC_CONVEX_URL` | Optional; defaults to placeholder |

Typecheck and build always run. Smoke e2e skips until Clerk secrets are set.

## Vercel + Convex (manual once)

1. Import the GitHub repo in Vercel (auto preview on PR, production on `main`).
2. Set Vercel env vars from `.env.example` (Clerk, Convex URL, app URL).
3. Create a Convex **production** deployment; set `CONVEX_DEPLOY_KEY` on Vercel if using `npx convex deploy --cmd 'npm run build'` as the build command (recommended for schema sync on deploy).
4. Point Stripe webhook to `https://YOUR_PROD.convex.site/stripe/webhook`.

## Test plan

1. `npm run typecheck`
2. `npm run build` with local `.env.local`
3. `npm run test:e2e:smoke`
4. Open a PR and confirm CI Typecheck + Build are green
