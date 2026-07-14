# RentaMart

US-only hybrid rental marketplace: public renter search/apply plus landlord ops.

**Layer 1:** list-first search, apply, platform application fee via Stripe test webhooks, status through under review, feature-flagged AI, demo seed, Playwright smoke tests.

**Layer 2 (this branch):** landlord portal, Stripe Connect test onboarding, org RBAC, self-serve listings with publish gates, approve/deny, deposit + first month via Connect, stub screening + AI assist, extended E2E stubs.

## Stack

Next.js (App Router), Convex, Clerk, Stripe Connect (test mode).

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
- Clerk JWT template named `convex` (set issuer in `convex/auth.config.ts`)
- Convex via `npx convex dev`
- Stripe test secret + webhook signing secret
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

3. Run Convex and the web app:

```bash
npx convex dev
npm run dev:web
```

Use `npx convex dev` for development. Do not use `npx convex deploy` unless promoting to production.

4. Stripe CLI webhook forward:

```bash
stripe listen --forward-to http://127.0.0.1:3211/stripe/webhook
```

```bash
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set STRIPE_SECRET_KEY sk_test_...
```

5. Seed demo listings:

```bash
npx convex env set SEED_ALLOW_UNAUTH true
# optional: attach current landlord to demo org on seed
# npx convex env set SEED_LANDLORD_CLERK_ID user_...
```

Sign in, call `seed:promoteSelfToPlatformAdmin` and `seed:demo`. Prefer turning `SEED_ALLOW_UNAUTH` back off after bootstrap.

6. Landlord portal

- Visit `/landlord` after sign-in
- Create an organization (or use seeded Demo Homes LLC membership)
- Complete Stripe Connect test onboarding under Connect
- Create and publish listings (publish requires Connect ready)
- Review applications in Applications inbox after renters pay the application fee

7. Optional AI:

```bash
npx convex env set AI_ENABLED true
npx convex env set GROQ_API_KEY gsk_...
```

## Money path

1. Renter pays application fee (platform) → application `under_review`
2. Landlord approves → `deposit_due`
3. Renter pays deposit (Connect destination) → `first_month_due`
4. Renter pays first month (Connect destination) → `move_in_ready`

Webhooks own paid state. UI never marks payments paid alone.

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

Public smoke tests run without Stripe. Full paths:

- `E2E_FULL=1` Layer 1 fee path
- `E2E_LAYER2=1` Layer 2 through move_in_ready
- `E2E_LAYER2_WEBHOOK_REPLAY=1` deposit replay

## Layers

- Layer 1: renter search, apply, application fee
- Layer 2: landlord portal, Connect, approve/deny, deposit/first month
- Layer 3: messaging, rent schedule, maintenance (not built)

## Commit hygiene

No em dash in commit messages. No agent co-author trailers. Do not hand-edit auto-generated changelogs. Keep feature branches after merge.
