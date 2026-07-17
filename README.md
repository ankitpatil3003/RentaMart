# RentaMart

US-only hybrid rental marketplace: public renter search/apply plus landlord ops.

**Layers 1–5 (v1.0.0):** renter marketplace, landlord portal with Stripe Connect, tenant ops, competitive selection with refunds, in-app notifications (optional email + toasts).

**Layer 6:** GitHub Actions CI and Vercel deploy docs for previews and production demos.

## Stack

Next.js (App Router), Convex, Clerk, Stripe Connect (test mode).

## Try the live demo (visitors)

RentaMart is intended for **Stripe test mode**. No real money moves. Anyone can sign up and walk the flow with Stripe’s test card.

### Test card (always)

| Field | Value |
| ----- | ----- |
| Card number | `4242 4242 4242 4242` |
| Expiry | Any future date (e.g. `12/34`) |
| CVC | Any 3 digits (e.g. `123`) |
| ZIP | Any (e.g. `10001`) |

Decline / other scenarios: [Stripe testing cards](https://docs.stripe.com/testing#cards).

### Suggested walkthrough

1. Open the deployed site (your Vercel URL, e.g. `https://rentamart.vercel.app`).
2. **Sign up / Sign in** with Clerk (email is fine).
3. **Browse listings** → open one → **Apply**.
4. Pay the **application fee** with `4242…`. Wait for status **Under review** (or click **Refresh payment status** if webhooks lag).
5. As a **landlord** (use a second account that a `platform_admin` approved via `/become-landlord`, or a seeded Demo Homes membership):
   - Complete **Stripe Connect** test onboarding (Connect → use Stripe’s test “skip verification” / provided test data).
   - Create/edit a listing → **Submit for review** → admin approves at `/admin/listings` → **Publish**.
   - **Approve** the application.
6. As the **renter**, pay **deposit**, then **first month** (again with `4242…`). Status becomes **Qualified**.
7. As the **landlord**, open Applications → **Select as tenant**. Winner becomes move-in ready; other paid applicants get deposit/first-month refunds (application fee stays non-refundable).
8. Try **Messages**, **Rent**, and **Maintenance** after move-in ready / moved in.

> Operators: seed demo listings after first deploy (see [Seed after deploy](#seed-after-deploy) below). Without seed data, renters will see an empty listings page.

## Setup (local)

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

4. Stripe CLI webhook forward (required for status updates):

```bash
# Use your Convex HTTP site URL from the dashboard / .env.local
# Example: https://content-bison-817.convex.site/stripe/webhook
stripe listen --forward-to https://YOUR_DEPLOYMENT.convex.site/stripe/webhook
```

```bash
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set STRIPE_SECRET_KEY sk_test_...
npx convex env set NEXT_PUBLIC_APP_URL http://localhost:3000
```

Keep `stripe listen` running while testing payments. Without it, Checkout can succeed in Stripe but your application status will stay stuck until you click **Refresh payment status** on the application page.

5. Bootstrap platform admin and seed demo listings:

Promote your user to `platform_admin` once via the Convex dashboard (patch
`users.roles` to include `"platform_admin"`), or run:

```bash
npx convex run internal.seed.promoteUserToPlatformAdmin '{"clerkUserId":"user_..."}'
```

Then sign in and run `seed:demo` (requires `platform_admin`). Never leave a
public self-promote mutation enabled in production.

6. Landlord portal (request and approve)

- Signed-in users request access at `/become-landlord` (org name + documents)
- A `platform_admin` reviews at `/admin/landlord-requests` and approves or denies
- After approval, open `/landlord`, complete Stripe Connect under Connect
- Create a listing draft, **Submit for review**, wait for `/admin/listings` approval
- Publish (requires authenticity approval **and** Connect ready)
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
4. Renter pays first month (Connect destination) → `qualified`
5. Landlord selects best applicant (not first-come-first-served) → winner `move_in_ready`, listing unpublished, others `refund_eligible` (deposit/first month refunded automatically; application fee non-refundable)
6. Landlord confirms move-in → `moved`

Webhooks own paid state. UI never marks payments paid alone.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev:web` | Next.js |
| `npx convex dev` | Convex sync |
| `npm run check` | lint + typecheck |
| `npm run typecheck` | TypeScript only |
| `npm run build` | Production Next.js build |
| `npm run test:e2e` | All Playwright tests |
| `npm run test:e2e:smoke` | Public + auth-redirect smoke tests |

## E2E

```bash
npx playwright install chromium
npm run test:e2e
```

Public smoke tests run without Stripe. Full paths:

- `E2E_FULL=1` Layer 1 fee path
- `E2E_LAYER2=1` Layer 2 through move_in_ready
- `E2E_LAYER2_WEBHOOK_REPLAY=1` deposit replay
- Layer 3 smoke (`e2e/layer3-smoke.spec.ts`) runs by default (auth redirects)
- Layer 4 smoke (`e2e/layer4-smoke.spec.ts`) landlord applications auth
- Layer 5 smoke (`e2e/layer5-smoke.spec.ts`) notifications auth

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and PRs to `develop` and `main`:

1. **Typecheck** — always
2. **Next.js build** — always (placeholder Convex URL; Clerk secrets used when present)
3. **Playwright smoke** — only when repository secrets are set:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - optional `NEXT_PUBLIC_CONVEX_URL`

Add those under **Settings → Secrets and variables → Actions**.

## Deploy (Vercel + Convex) — first-time checklist

Your Vercel home page only lists projects you already created. **RentaMart is a new project** — use **Add New… → Project**, not an old app.

Do this in order: Convex production → Clerk URLs → Stripe webhook → Vercel import → seed.

### 1. Convex production deployment

On your machine, from the repo root (logged into Convex):

```bash
npx convex deploy
```

When prompted, create/select a **production** deployment (separate from your local `npx convex dev` one).

Copy from the Convex dashboard:

- **Deployment URL** → `NEXT_PUBLIC_CONVEX_URL` (looks like `https://happy-animal-123.convex.cloud`)
- **HTTP Actions URL** → `NEXT_PUBLIC_CONVEX_SITE_URL` (looks like `https://happy-animal-123.convex.site`)

Set Stripe + app URL on that **production** deployment:

```bash
npx convex env set STRIPE_SECRET_KEY sk_test_...
npx convex env set NEXT_PUBLIC_APP_URL https://YOUR-VERCEL-URL.vercel.app
```

(You will set `STRIPE_WEBHOOK_SECRET` after creating the Stripe webhook in step 3.)

Optional: create a [Convex deploy key](https://dashboard.convex.dev) and later set `CONVEX_DEPLOY_KEY` on Vercel so builds run `npx convex deploy --cmd 'npm run build'`.

### 2. Clerk (allow the Vercel domain)

In [Clerk Dashboard](https://dashboard.clerk.com) → your application:

1. Confirm a JWT template named **`convex`** exists (required by `convex/auth.config.ts`).
2. **Paths:** sign-in `/sign-in`, sign-up `/sign-up` (already in `.env.example`).
3. After you know the Vercel URL, under **Domains / Allowed origins / Redirect URLs**, add:
   - `https://YOUR-PROJECT.vercel.app`
   - `https://YOUR-PROJECT.vercel.app/sign-in`
   - `https://YOUR-PROJECT.vercel.app/sign-up`
   - (and Clerk’s suggested callback URLs for that host)

Copy:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_test_…` or `pk_live_…` — use **test** for demos)
- `CLERK_SECRET_KEY` (`sk_test_…`)

### 3. Stripe test mode webhook (production Convex)

In [Stripe Dashboard](https://dashboard.stripe.com) → **Test mode** ON:

1. **Developers → Webhooks → Add endpoint**
2. Endpoint URL:

```text
https://YOUR_PROD_DEPLOYMENT.convex.site/stripe/webhook
```

3. Events to send (minimum):
   - `checkout.session.completed`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `account.updated` (Connect)
4. Copy the signing secret (`whsec_…`) and set it on Convex production:

```bash
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
```

Also keep `STRIPE_SECRET_KEY` as a **test** key (`sk_test_…`). Visitors will pay with `4242 4242 4242 4242`.

### 4. Create the Vercel project (new, not your old one)

1. Open [vercel.com/dashboard](https://vercel.com/dashboard).
2. Click **Add New…** → **Project** (top right). Do not open your old project.
3. **Import Git Repository** → choose `ankitpatil3003/RentaMart`  
   (If missing: **Adjust GitHub App Permissions** and grant access to this repo.)
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `.` (repo root)
   - **Production Branch:** `main`
5. **Environment Variables** → add for **Production** and **Preview**:

| Name | Value |
| ---- | ----- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from Clerk |
| `CLERK_SECRET_KEY` | from Clerk |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CONVEX_URL` | Convex production deployment URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP Actions / `.site` URL |
| `NEXT_PUBLIC_APP_URL` | temporary `https://placeholder.vercel.app`, then update after first deploy |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (optional on web if unused in UI) |

6. Click **Deploy**. Wait for the build to finish.
7. Copy the real URL (e.g. `https://renta-mart-xxxx.vercel.app`).
8. Update:
   - Vercel env `NEXT_PUBLIC_APP_URL` → that URL → **Redeploy**
   - Convex: `npx convex env set NEXT_PUBLIC_APP_URL https://your-real-url.vercel.app`
   - Clerk allowed origins / redirect URLs for that host
9. Share the Vercel URL. Visitors follow [Try the live demo](#try-the-live-demo-visitors).

### Seed after deploy

With the production Convex deployment selected, promote yourself to
`platform_admin` once (Convex dashboard patch on `users.roles`, or):

```bash
npx convex run internal.seed.promoteUserToPlatformAdmin '{"clerkUserId":"user_..."}'
```

Then run `seed:demo` as that admin. Optional:

```bash
npx convex env set SEED_LANDLORD_CLERK_ID user_...
```

Do **not** use `SEED_ALLOW_UNAUTH` in production. Self-serve org creation is
disabled; landlords onboard via `/become-landlord` → admin approve.

Create/publish a listing as landlord: Connect onboarding → submit listing for
authenticity review → admin approve at `/admin/listings` → Publish.

### Local vs production

| Concern | Local | Public demo |
| ------- | ----- | ----------- |
| Convex | `npx convex dev` | `npx convex deploy` |
| Web | `npm run dev:web` | Vercel (new project from GitHub) |
| Stripe webhooks | Stripe CLI → Convex `.site` URL | Stripe Dashboard endpoint → Convex `.site` URL |
| Payments | Test card `4242…` | Same test card `4242…` |

### Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Vercel only shows an old project | **Add New… → Project** and import `RentaMart` from GitHub |
| Build fails on missing env | Add all table vars above, then Redeploy |
| Clerk “redirect” / auth errors | Add the Vercel domain to Clerk allowlists |
| Payment succeeds in Stripe but status stuck | Webhook URL wrong or `STRIPE_WEBHOOK_SECRET` missing on Convex; use **Refresh payment status** |
| Empty listings | Run seed + publish a Connect-ready listing |

## Layers

- Layer 1: renter search, apply, application fee
- Layer 2: landlord portal, Connect, approve/deny, deposit/first month
- Layer 3: messaging, rent schedule, maintenance (tenant ops after move-in)
- Layer 4: competitive selection, refunds, move-in confirmation
- Layer 5: in-app notifications for application status changes
- Layer 6: CI (GitHub Actions) + Vercel deploy docs

## Layer 5 notifications

In-app notifications for renters and landlords when application status changes:

- **Renter:** approved, qualified, selected, not selected, refund completed, denied
- **Landlord:** application fee paid, applicant qualified, tenant selected, moved in

Routes: `/notifications` (renter), `/landlord/notifications?orgId=...` (landlord). Unread badges appear in the site header and landlord nav.

### Layer 5.1 email + toasts

- **Live toasts:** Signed-in users see a dismissible toast when a new unread notification arrives (no page refresh needed).
- **Optional email (off by default):** Set on the Convex deployment:

```bash
npx convex env set EMAIL_ENABLED true
npx convex env set RESEND_API_KEY re_...
# optional: npx convex env set EMAIL_FROM "RentaMart <you@yourdomain.com>"
```

Emails use Resend. Without `EMAIL_ENABLED=true` and a valid key, notifications stay in-app only. Application fee remains non-refundable regardless of channel.

## Layer 4 competitive selection

Multiple applicants can pay deposit and first month on the same listing. The landlord chooses the most qualified tenant (US norm: not first-come-first-served).

- **Qualified:** All required move-in payments complete; awaiting landlord selection
- **Select tenant:** Winner becomes move-in ready (lease created); listing is unpublished; non-selected applicants who paid deposit/first month become refund eligible (refunds process automatically via Stripe)
- **Moved:** Landlord confirms keys handed over
- **Application fee:** Non-refundable (screening performed)

## Layer 3 tenant ops

After an application reaches **move-in ready**, RentaMart creates an active lease and seeds monthly rent charges.

- **Messages** (`/messages`): renter ↔ landlord chat per application
- **Rent** (`/rent`): pay monthly rent via Stripe Connect Checkout (webhook truth)
- **Maintenance** (`/maintenance`): renters submit requests; landlords update status under `/landlord/maintenance`

Landlord views: Messages, Rent, and Maintenance tabs in the landlord portal (require `orgId` query param).

## Commit hygiene

No em dash in commit messages. No agent co-author trailers. Do not hand-edit auto-generated changelogs. Keep feature branches after merge.
