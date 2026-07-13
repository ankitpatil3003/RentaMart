# RentaMart

US-only hybrid rental marketplace: public renter search/apply plus landlord ops (later layers).

Layer 1 (this branch): list-first search, apply, platform application fee via Stripe test webhooks, status through `fee_paid` / `fee_failed`, feature-flagged AI, demo seed, Playwright smoke tests.

## Stack

Next.js (App Router), Convex, Clerk, Stripe Connect (test mode; Connect payouts in Layer 2).

## Setup

1. Clone and install:

```bash
npm install
```

2. Copy env and fill values (never commit secrets):

```bash
cp .env.example .env.local
```

Required for a full local loop:

- Clerk publishable + secret keys
- Clerk JWT template named `convex` (issuer domain → `CLERK_JWT_ISSUER_DOMAIN`, also `npx convex env set CLERK_JWT_ISSUER_DOMAIN ...`)
- Convex via `npx convex dev` (or anonymous local backend for agents)
- Stripe test secret + webhook signing secret
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

3. Run Convex and the web app (two terminals, or `npm run dev` after `npm install`):

```bash
npx convex dev
npm run dev:web
```

Use `npx convex dev` for development. Do not use `npx convex deploy` unless promoting to production.

4. Stripe CLI webhook forward (replace site URL from Convex):

```bash
stripe listen --forward-to http://127.0.0.1:3211/stripe/webhook
```

Set the printed `whsec_...` into Convex env:

```bash
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set STRIPE_SECRET_KEY sk_test_...
```

5. Seed demo listings (local bootstrap):

```bash
npx convex env set SEED_ALLOW_UNAUTH true
```

Sign in once in the app, then in Convex dashboard or via a signed mutation call `seed:promoteSelfToPlatformAdmin` and `seed:demo`. Prefer promoting to `platform_admin` and turning `SEED_ALLOW_UNAUTH` back off.

6. Optional AI:

```bash
npx convex env set AI_ENABLED true
# optional
npx convex env set GROQ_API_KEY gsk_...
```

Apply/pay works with AI off.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev:web` | Next.js |
| `npx convex dev` | Convex sync |
| `npm run check` | lint + typecheck |
| `npm run test:e2e` | Playwright |

## E2E

```bash
npx playwright install chromium
npm run test:e2e
```

Public smoke tests run without Stripe. Full golden path and webhook replay require `E2E_FULL=1` / `E2E_WEBHOOK_REPLAY=1` plus secrets.

## Layers

- Layer 1: renter search, apply, application fee
- Layer 2: landlord portal, Connect, approve/deny, deposit/first month
- Layer 3: messaging, rent schedule, maintenance

## Commit hygiene

No em dash in commit messages. No agent co-author trailers. Do not hand-edit auto-generated changelogs. Keep feature branches after merge.
