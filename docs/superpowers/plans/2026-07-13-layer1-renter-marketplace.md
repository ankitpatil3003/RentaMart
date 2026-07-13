# RentaMart Layer 1 (Renter Marketplace) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working US renter path: list-first search, listing detail, apply, platform application fee via Stripe test webhooks, status through `fee_paid` / `fee_failed`, feature-flagged AI search/Q&A, demo seed, and Playwright E2E (search → apply → fee + webhook replay idempotency).

**Architecture:** Next.js App Router UI + Clerk identity + Convex modular domains (`users`, `orgs`, `listings`, `applications`, `payments`, `ai`). Stripe Checkout for `application_fee` to the platform; Convex HTTP webhook owns paid state and writes an idempotent ledger keyed by `appfee:{applicationId}` and `stripeEventId`. AI returns filter/answer DTOs only and is off by default without breaking apply/pay.

**Tech Stack:** Next.js (App Router, TypeScript), Convex, Clerk, Stripe (test mode + CLI), Playwright, optional Groq for AI, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-07-13-rentamart-design.md`  
**Out of scope (Layer 2+):** Connect payouts, landlord portal, approve/deny, deposit/first month, messaging, maps, real screening.

**Commit hygiene (always):** No em dash in commit messages. Never add `Co-authored-by: Cursor` (if injected, rewrite with `git commit-tree` / strip before push). Never hand-edit auto-generated changelogs. Prefer quality and maintainability over short-term cost. Do not delete feature branches on merge.

**Hard gate already cleared for this plan:** Spec approved. **Do not start scaffolding until this Layer 1 plan is approved.**

---

## File structure (locked for Layer 1)

```
apps/web/                          # Next.js app (or repo root if create-next-app lands at root)
  app/
    layout.tsx                     # Clerk + Convex providers
    page.tsx                       # Redirect or marketing home → /listings
    listings/page.tsx              # List-first search + filters
    listings/[id]/page.tsx         # Listing detail + apply CTA + optional AI Q&A
    applications/[id]/page.tsx     # Application status + pay fee CTA
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
  components/
    listings/ListingCard.tsx
    listings/ListingFilters.tsx
    listings/ListingQa.tsx
    applications/ApplicationStatus.tsx
    ai/SearchAssist.tsx
  lib/
    format.ts                      # currency/beds helpers
    env.ts                         # public env reads
  e2e/
    golden-path.spec.ts
    webhook-replay.spec.ts
  playwright.config.ts
  .env.example
  package.json

convex/
  schema.ts
  http.ts                          # Stripe webhook HTTP router
  lib/
    auth.ts                        # getCurrentUser / requireUser
    customFunctions.ts             # authedQuery / authedMutation
    money.ts                       # cents helpers, idempotency key builders
    stripe.ts                      # Stripe client (actions only; no secrets in client)
  users.ts
  orgs.ts                          # minimal org for seed (Layer 1 read/seed only)
  listings.ts
  applications.ts
  payments.ts
  paymentsActions.ts               # "use node" Checkout session create
  seed.ts                          # platform_admin seed
  ai.ts                            # feature-flagged NL→filters + listing Q&A DTOs
  aiActions.ts                     # "use node" Groq/Ollama call (optional)
  _generated/                      # Convex codegen (never hand-edit)

README.md                          # setup, env, convex dev, Stripe CLI, E2E
```

Monorepo note: Prefer **repo-root** Next.js + `convex/` at repo root (simplest for Cursor/agents). If scaffolding creates `apps/web`, keep Convex at repo root and point `convex.json` accordingly. This plan assumes **repo root** for paths below.

---

### Task 1: Scaffold Next.js + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore` (merge), `eslint.config.mjs`
- Modify: `README.md` (replace stub with setup outline; expand in Task 12)

- [ ] **Step 1: Scaffold the app at repo root**

Run from repo root (PowerShell):

```powershell
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --turbopack --yes
```

If create-next-app refuses non-empty dir, scaffold into a temp folder and move files, preserving `docs/`, `.git/`, `LICENSE`, and the design spec.

Expected: Next.js app boots.

- [ ] **Step 2: Verify dev server starts**

```powershell
npm run dev
```

Expected: App loads on `http://localhost:3000`. Stop the server after smoke check.

- [ ] **Step 3: Replace home page with RentaMart brand shell**

`app/page.tsx`:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <h1 className="text-5xl font-semibold tracking-tight">RentaMart</h1>
      <p className="mt-4 max-w-xl text-lg text-neutral-600">
        Find a place. Apply simply. Track your status.
      </p>
      <Link
        href="/listings"
        className="mt-8 inline-block rounded-md bg-neutral-900 px-5 py-3 text-white"
      >
        Browse listings
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs .gitignore README.md public
# amend list to match actual scaffold output; never add .env
```

Use commit-tree if Cursor injects co-author. Message:

```text
Scaffold Next.js App Router for RentaMart Layer 1
```

---

### Task 2: Convex init + schema (Layer 1 tables)

**Files:**
- Create: `convex/schema.ts`, `convex/tsconfig.json`, `convex.json` (as generated)
- Never hand-edit: `convex/_generated/**`

- [ ] **Step 1: Init Convex**

```powershell
npm install convex
npx convex dev
```

Complete login/project linking in your environment. Keep `npx convex dev` running in a second terminal during later tasks. Do **not** use `npx convex deploy` for development.

- [ ] **Step 2: Write schema**

`convex/schema.ts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const applicationStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("fee_pending"),
  v.literal("fee_paid"),
  v.literal("fee_failed"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("deposit_due"),
  v.literal("deposit_paid"),
  v.literal("first_month_due"),
  v.literal("first_month_paid"),
  v.literal("move_in_ready"),
  v.literal("canceled"),
);

export const paymentType = v.union(
  v.literal("application_fee"),
  v.literal("deposit"),
  v.literal("first_month"),
);

export const paymentStatus = v.union(
  v.literal("created"),
  v.literal("checkout_open"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("canceled"),
);

export const role = v.union(
  v.literal("renter"),
  v.literal("org_owner"),
  v.literal("leasing_agent"),
  v.literal("platform_admin"),
);

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    roles: v.array(role),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  orgs: defineTable({
    name: v.string(),
    // Layer 2 fills Connect; Layer 1 seed may set placeholders
    stripeConnectAccountId: v.optional(v.string()),
    connectReady: v.boolean(),
  }).index("by_name", ["name"]),

  orgMembers: defineTable({
    orgId: v.id("orgs"),
    userId: v.id("users"),
    role: v.union(v.literal("org_owner"), v.literal("leasing_agent")),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_and_user", ["orgId", "userId"]),

  listings: defineTable({
    orgId: v.id("orgs"),
    title: v.string(),
    description: v.string(),
    city: v.string(),
    state: v.string(), // US state code e.g. "NY"
    zip: v.string(),
    rentCents: v.number(),
    beds: v.number(),
    baths: v.number(),
    photoUrls: v.array(v.string()),
    published: v.boolean(),
    applicationFeeCents: v.number(),
  })
    .index("by_published", ["published"])
    .index("by_org", ["orgId"])
    .index("by_city_published", ["city", "published"]),

  applications: defineTable({
    listingId: v.id("listings"),
    renterUserId: v.id("users"),
    status: applicationStatus,
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    message: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
  })
    .index("by_renter", ["renterUserId"])
    .index("by_listing", ["listingId"])
    .index("by_renter_and_listing", ["renterUserId", "listingId"]),

  payments: defineTable({
    applicationId: v.id("applications"),
    type: paymentType,
    status: paymentStatus,
    amountCents: v.number(),
    currency: v.literal("usd"),
    idempotencyKey: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeEventId: v.optional(v.string()),
  })
    .index("by_application", ["applicationId"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_stripeEventId", ["stripeEventId"])
    .index("by_checkoutSession", ["stripeCheckoutSessionId"]),

  stripeEvents: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    processedAt: v.number(),
  }).index("by_stripeEventId", ["stripeEventId"]),
});
```

- [ ] **Step 3: Confirm Convex accepts schema**

With `npx convex dev` running, expected: schema push succeeds with no errors.

- [ ] **Step 4: Commit**

Message:

```text
Add Convex schema for Layer 1 listings applications and payments
```

---

### Task 3: Auth helpers + Clerk wiring

**Files:**
- Create: `convex/lib/auth.ts`, `convex/lib/customFunctions.ts`, `convex/users.ts`
- Create: `middleware.ts`, `app/providers.tsx` (or inline providers in layout)
- Modify: `app/layout.tsx`, `.env.example`

- [ ] **Step 1: Install Clerk + Convex auth packages**

```powershell
npm install @clerk/nextjs @clerk/backend convex
npx convex-helpers 2>$null
npm install convex-helpers
```

- [ ] **Step 2: Auth helpers**

`convex/lib/auth.ts`:

```ts
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

export async function getIdentityOrNull(ctx: Ctx) {
  return await ctx.auth.getUserIdentity();
}

export async function requireIdentity(ctx: Ctx) {
  const identity = await getIdentityOrNull(ctx);
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

export async function getCurrentUserOrNull(
  ctx: Ctx,
): Promise<Doc<"users"> | null> {
  const identity = await getIdentityOrNull(ctx);
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUserOrNull(ctx);
  if (!user) {
    throw new Error("User profile not found");
  }
  return user;
}

export function userHasRole(
  user: Doc<"users">,
  role: Doc<"users">["roles"][number],
): boolean {
  return user.roles.includes(role);
}
```

`convex/lib/customFunctions.ts`:

```ts
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { requireUser } from "./auth";

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx, args) => {
    const user = await requireUser(ctx);
    return { ctx: { ...ctx, user }, args };
  },
});

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, args) => {
    const user = await requireUser(ctx);
    return { ctx: { ...ctx, user }, args };
  },
});
```

- [ ] **Step 3: Upsert user on first authenticated call**

`convex/users.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";

export const me = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      roles: v.array(
        v.union(
          v.literal("renter"),
          v.literal("org_owner"),
          v.literal("leasing_agent"),
          v.literal("platform_admin"),
        ),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };
  },
});

export const ensureUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (existing) return existing._id;
    const email = identity.email ?? `${identity.subject}@users.clerk.local`;
    return await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      email,
      name: identity.name,
      roles: ["renter"],
    });
  },
});
```

- [ ] **Step 4: Wire Clerk + ConvexProviderWithClerk in Next.js**

Follow current Clerk+Convex docs for JWT template named `convex` and env vars:

`.env.example`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
CLERK_JWT_ISSUER_DOMAIN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
APPLICATION_FEE_CENTS=5000
NEXT_PUBLIC_APP_URL=http://localhost:3000
AI_ENABLED=false
GROQ_API_KEY=
```

Add `middleware.ts` protecting `/applications(.*)` while leaving `/listings` public. Add sign-in/sign-up catch-all routes under `app/sign-in` and `app/sign-up`.

- [ ] **Step 5: Manual smoke**

Sign up a test Clerk user in the UI; call `ensureUser`; confirm `users` row in Convex dashboard.

- [ ] **Step 6: Commit**

```text
Wire Clerk auth and Convex user upsert for renters
```

---

### Task 4: Listings public search + detail

**Files:**
- Create: `convex/listings.ts`, `app/listings/page.tsx`, `app/listings/[id]/page.tsx`, `components/listings/ListingCard.tsx`, `components/listings/ListingFilters.tsx`, `lib/format.ts`

- [ ] **Step 1: Convex public queries**

`convex/listings.ts`:

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

const listingPublic = v.object({
  _id: v.id("listings"),
  title: v.string(),
  city: v.string(),
  state: v.string(),
  rentCents: v.number(),
  beds: v.number(),
  baths: v.number(),
  photoUrls: v.array(v.string()),
  applicationFeeCents: v.number(),
});

export const search = query({
  args: {
    city: v.optional(v.string()),
    maxRentCents: v.optional(v.number()),
    minBeds: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(listingPublic),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    // Prefer indexes; filter remaining fields in TS on the page
    const result = args.city
      ? await ctx.db
          .query("listings")
          .withIndex("by_city_published", (q) =>
            q.eq("city", args.city!).eq("published", true),
          )
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("listings")
          .withIndex("by_published", (q) => q.eq("published", true))
          .paginate(args.paginationOpts);

    const page = result.page
      .filter((l) =>
        args.maxRentCents === undefined
          ? true
          : l.rentCents <= args.maxRentCents,
      )
      .filter((l) =>
        args.minBeds === undefined ? true : l.beds >= args.minBeds,
      )
      .map((l) => ({
        _id: l._id,
        title: l.title,
        city: l.city,
        state: l.state,
        rentCents: l.rentCents,
        beds: l.beds,
        baths: l.baths,
        photoUrls: l.photoUrls,
        applicationFeeCents: l.applicationFeeCents,
      }));

    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getById = query({
  args: { listingId: v.id("listings") },
  returns: v.union(
    v.object({
      _id: v.id("listings"),
      title: v.string(),
      description: v.string(),
      city: v.string(),
      state: v.string(),
      zip: v.string(),
      rentCents: v.number(),
      beds: v.number(),
      baths: v.number(),
      photoUrls: v.array(v.string()),
      applicationFeeCents: v.number(),
      published: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing || !listing.published) return null;
    return {
      _id: listing._id,
      title: listing.title,
      description: listing.description,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      rentCents: listing.rentCents,
      beds: listing.beds,
      baths: listing.baths,
      photoUrls: listing.photoUrls,
      applicationFeeCents: listing.applicationFeeCents,
      published: listing.published,
    };
  },
});
```

- [ ] **Step 2: UI list + filters (one job: browse)**

Implement `ListingFilters` with fields: city (text), max rent (number), min beds (number). List uses `usePaginatedQuery(api.listings.search, ...)`. Cards link to `/listings/[id]`. No map. No cards-as-decoration beyond interactive listing selection.

- [ ] **Step 3: Detail page**

Show photos (placeholder OK), rent, beds/baths, location, description, primary CTA **Apply** → requires sign-in then `/applications` flow (Task 5).

- [ ] **Step 4: Format helper**

```ts
// lib/format.ts
export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
```

- [ ] **Step 5: Manual UI check**

With empty DB, list shows empty state copy: "No listings yet." After seed (Task 8), list shows seeded homes.

- [ ] **Step 6: Commit**

```text
Add public listing search and detail pages
```

---

### Task 5: Applications (draft → submitted → fee_pending)

**Files:**
- Create: `convex/applications.ts`, `app/applications/[id]/page.tsx`, `components/applications/ApplicationStatus.tsx`, apply form component on listing detail or `/listings/[id]/apply`

Layer 1 status ownership: through `fee_paid` / `fee_failed` only. Do not implement landlord approve/deny.

- [ ] **Step 1: Mutations/queries**

`convex/applications.ts` (core behavior):

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { applicationStatus } from "./schema";

export const getMine = query({
  args: { applicationId: v.id("applications") },
  returns: v.union(
    v.object({
      _id: v.id("applications"),
      listingId: v.id("listings"),
      status: applicationStatus,
      fullName: v.string(),
      email: v.string(),
      phone: v.string(),
      message: v.optional(v.string()),
      submittedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app || app.renterUserId !== user._id) return null;
    return {
      _id: app._id,
      listingId: app.listingId,
      status: app.status,
      fullName: app.fullName,
      email: app.email,
      phone: app.phone,
      message: app.message,
      submittedAt: app.submittedAt,
    };
  },
});

export const createDraft = mutation({
  args: {
    listingId: v.id("listings"),
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.id("applications"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing || !listing.published) {
      throw new Error("Listing not found");
    }
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_renter_and_listing", (q) =>
        q.eq("renterUserId", user._id).eq("listingId", args.listingId),
      )
      .first();
    if (existing && existing.status !== "canceled") {
      return existing._id;
    }
    return await ctx.db.insert("applications", {
      listingId: args.listingId,
      renterUserId: user._id,
      status: "draft",
      fullName: args.fullName,
      email: args.email,
      phone: args.phone,
      message: args.message,
    });
  },
});

export const submit = mutation({
  args: { applicationId: v.id("applications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app || app.renterUserId !== user._id) {
      throw new Error("Application not found");
    }
    if (app.status !== "draft") {
      throw new Error("Only draft applications can be submitted");
    }
    await ctx.db.patch(args.applicationId, {
      status: "submitted",
      submittedAt: Date.now(),
    });
    // Immediately move to fee_pending when entering payment create (payments.ts)
    return null;
  },
});
```

Mark status `fee_pending` inside payment session creation (Task 6), not from the client alone.

- [ ] **Step 2: Apply form UI**

Single screen form: full name, email, phone, optional message. Submit creates draft then calls submit, then redirects to application status page with Pay fee CTA.

- [ ] **Step 3: Status component**

Show human-readable status only. Never show a "Mark paid" button. Paid appears only after webhook (Task 7).

- [ ] **Step 4: Commit**

```text
Add renter application draft and submit flow
```

---

### Task 6: Application fee Checkout (platform)

**Files:**
- Create: `convex/lib/money.ts`, `convex/payments.ts`, `convex/paymentsActions.ts`
- Modify: application status page to start Checkout

- [ ] **Step 1: Money helpers**

```ts
// convex/lib/money.ts
import type { Id } from "../_generated/dataModel";

export function appFeeIdempotencyKey(applicationId: Id<"applications">) {
  return `appfee:${applicationId}`;
}

export function readApplicationFeeCents(): number {
  const raw = process.env.APPLICATION_FEE_CENTS;
  const n = raw ? Number(raw) : 5000;
  if (!Number.isFinite(n) || n <= 0) return 5000;
  return Math.floor(n);
}
```

Note: `readApplicationFeeCents` for actions reads env; for mutations prefer passing amount from listing.`applicationFeeCents`.

- [ ] **Step 2: Internal ledger create + public queries**

`convex/payments.ts`:

- `getByApplication` (authed, owner only): returns latest `application_fee` payment for UI.
- `internalEnsureAppFeePayment`: inserts `payments` row with `idempotencyKey`, status `created`, type `application_fee`, amount from listing.
- `internalMarkCheckoutOpen`: stores `stripeCheckoutSessionId`, sets payment `checkout_open`, application `fee_pending`.
- `internalApplyCheckoutSucceeded` / `Failed`: only callable from HTTP webhook handler path (internal mutations). On success: payment `succeeded`, application `fee_paid`, store `stripeEventId` + payment intent id. On failure: `fee_failed`.
- Reject second success for same idempotency key / event id (idempotent no-op).

- [ ] **Step 3: Node action creates Checkout Session**

`convex/paymentsActions.ts`:

```ts
"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const createApplicationFeeCheckout = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const prepared = await ctx.runMutation(
      internal.payments.prepareApplicationFeeCheckout,
      { applicationId: args.applicationId },
    );

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/applications/${args.applicationId}?paid=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/applications/${args.applicationId}?canceled=1`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: prepared.amountCents,
              product_data: { name: "RentaMart application fee" },
            },
          },
        ],
        metadata: {
          applicationId: args.applicationId,
          paymentId: prepared.paymentId,
          type: "application_fee",
          idempotencyKey: prepared.idempotencyKey,
        },
      },
      { idempotencyKey: prepared.idempotencyKey },
    );

    if (!session.url) throw new Error("Stripe did not return a checkout URL");

    await ctx.runMutation(internal.payments.markCheckoutOpen, {
      paymentId: prepared.paymentId,
      stripeCheckoutSessionId: session.id,
      applicationId: args.applicationId,
    });

    return { url: session.url };
  },
});
```

Install: `npm install stripe`.

UI: button "Pay application fee" calls this action and `window.location = url`. Success query param does **not** set paid in DB.

- [ ] **Step 4: Commit**

```text
Add Stripe Checkout action for platform application fee
```

---

### Task 7: Stripe webhook HTTP action (truth + idempotency)

**Files:**
- Create: `convex/http.ts`
- Modify: `convex/payments.ts` (internal apply helpers)
- Document Stripe CLI in README (Task 12)

- [ ] **Step 1: HTTP router**

`convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }
    const body = await request.text();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    const already = await ctx.runQuery(internal.payments.getStripeEvent, {
      stripeEventId: event.id,
    });
    if (already) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        status: 200,
      });
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      await ctx.runMutation(internal.payments.applyStripeCheckoutEvent, {
        stripeEventId: event.id,
        type: event.type,
        session: event.data.object,
      });
    }

    await ctx.runMutation(internal.payments.recordStripeEvent, {
      stripeEventId: event.id,
      type: event.type,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }),
});

export default http;
```

Adjust Stripe import for Convex HTTP action runtime (may need `"use node"` HTTP actions pattern per current Convex docs; if Stripe SDK needs Node, put verify+dispatch in `internalAction` and keep httpAction thin). Preferred pattern if HTTP cannot use Stripe SDK:

1. `httpAction` reads raw body + signature header  
2. schedules/runs `internal.paymentsActions.verifyAndApply` with `"use node"`  
3. That action verifies, then `runMutation` apply helpers  

Implement the pattern that matches the Convex version in use; do not skip signature verification.

- [ ] **Step 2: Idempotent apply rules**

- Lookup payment by metadata `idempotencyKey` or `paymentId`  
- If payment already `succeeded`, return without changing application again  
- Insert `stripeEvents` row once  
- Application transitions: success → `fee_paid`; fail/expire → `fee_failed` only from `fee_pending` / `submitted`

- [ ] **Step 3: Local forward**

```powershell
stripe listen --forward-to https://<YOUR_CONVEX_SITE>/stripe/webhook
```

Put webhook signing secret into Convex env: `npx convex env set STRIPE_WEBHOOK_SECRET whsec_...` and Stripe secret similarly. Never commit secrets.

- [ ] **Step 4: Manual test**

Complete test card `4242...` Checkout; confirm application status becomes `fee_paid` and ledger `succeeded` without UI "mark paid".

- [ ] **Step 5: Commit**

```text
Add Stripe webhook handler with event dedupe and ledger updates
```

---

### Task 8: Demo seed (platform_admin)

**Files:**
- Create: `convex/seed.ts`, `convex/orgs.ts` (minimal inserts used by seed)

- [ ] **Step 1: Seed mutation**

Only callable when `userHasRole(user, "platform_admin")`. For first bootstrap, add a one-time `internal` seed runnable from Convex dashboard / `npx convex run` that does **not** require admin if `SEED_ALLOW_UNAUTH=true` **only in development** (Convex env), then remove or keep gated.

Preferred safer path:

1. Manually promote your user to `platform_admin` via Convex dashboard patch once.  
2. Call `seed.demo`.

Seed creates:

- Org `Demo Homes LLC` with `connectReady: false` (Layer 2)  
- 3 published listings in US cities (e.g. Austin TX, Denver CO, Brooklyn NY) with placeholder photo URLs (`https://images.unsplash.com/...` or solid placeholders)  
- Distinct rents/beds for filter testing  
- `applicationFeeCents` aligned with `APPLICATION_FEE_CENTS` default (5000)

Idempotent seed: if org name exists, skip recreate; upsert listings by title+org.

- [ ] **Step 2: Run seed**

```powershell
npx convex run seed:demo
```

Expected: listings appear on `/listings`.

- [ ] **Step 3: Commit**

```text
Add platform admin demo seed for listings and org
```

---

### Task 9: Feature-flagged AI search + listing Q&A

**Files:**
- Create: `convex/ai.ts`, `convex/aiActions.ts`, `components/ai/SearchAssist.tsx`, `components/listings/ListingQa.tsx`

- [ ] **Step 1: Guardrails contract**

Public Convex functions:

- `ai.parseSearch` → `{ city?, maxRentCents?, minBeds?, explanation }` only  
- `ai.askListing` → `{ answer, citations: string[] }` from listing snapshot fields only  

Banned: any payment/status/role mutation from AI modules. `AI_ENABLED !== "true"` returns static friendly disabled DTO without calling LLM.

- [ ] **Step 2: Optional Groq action**

`aiActions.ts` with `"use node"`. If no `GROQ_API_KEY`, return heuristic parser (regex for beds/city/budget) so demos work offline.

- [ ] **Step 3: UI**

Search page: optional "Ask RentaMart" box applying returned filters to the list. Listing detail: Q&A panel only when `NEXT_PUBLIC_AI_ENABLED=true` (mirror server flag). Apply/pay pages must work with AI off.

- [ ] **Step 4: Commit**

```text
Add feature flagged AI search filters and listing Q and A
```

---

### Task 10: Playwright E2E golden path + webhook replay

**Files:**
- Create: `playwright.config.ts`, `e2e/golden-path.spec.ts`, `e2e/webhook-replay.spec.ts`, `e2e/helpers/auth.ts`, `e2e/helpers/stripe.ts`
- Modify: `package.json` scripts `"test:e2e": "playwright test"`

- [ ] **Step 1: Install Playwright**

```powershell
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Golden path (user-visible)**

`e2e/golden-path.spec.ts` must:

1. Open `/listings`  
2. Assert seeded listing cards look correct (title, rent visible, no broken layout)  
3. Open a listing → Apply (Clerk test user / storageState)  
4. Submit application form  
5. Start Checkout; complete Stripe test payment (or use Stripe test helpers / CLI trigger if full Checkout automation is brittle)  
6. Assert application page shows **paid / fee paid** only after webhook processing (poll UI)  
7. Assert Convex ledger via a small authenticated debug query `payments.getByApplication` exposed to the test user (or seed assertion mutation for E2E only behind `E2E_MODE`)

Be picky about UI copy and spacing; fix obvious visual issues found during this test.

- [ ] **Step 3: Webhook replay idempotency**

`e2e/webhook-replay.spec.ts`:

1. Create fee_pending application + payment with known Checkout session fixture  
2. POST the same signed Stripe event payload twice to `/stripe/webhook`  
3. Assert still one `succeeded` payment and application still `fee_paid` (not duplicated ledger rows)

- [ ] **Step 4: Run E2E**

```powershell
npm run test:e2e
```

Expected: PASS. Failures and flakes are blockers; fix before proceeding.

- [ ] **Step 5: Commit**

```text
Add Playwright E2E for apply fee and webhook replay
```

---

### Task 11: Lint, types, and engineering bar

- [ ] **Step 1: Add scripts**

```json
"lint": "eslint .",
"typecheck": "tsc --noEmit",
"test:e2e": "playwright test",
"check": "npm run lint && npm run typecheck"
```

Install `@convex-dev/eslint-plugin` and enable recommended Convex rules.

- [ ] **Step 2: Run check**

```powershell
npm run check
npm run test:e2e
```

Fix all failures. No ignored flakes.

- [ ] **Step 3: Commit**

```text
Tighten lint and typecheck for Layer 1 quality bar
```

---

### Task 12: README + env example completion

**Files:**
- Modify: `README.md`, `.env.example`

- [ ] **Step 1: README sections**

1. Product one-liner (no funding language)  
2. Stack  
3. Setup: clone, `npm install`, copy `.env.example`  
4. Clerk JWT template for Convex  
5. `npx convex dev` + `npm run dev`  
6. Stripe test keys + `stripe listen --forward-to .../stripe/webhook`  
7. Seed: promote admin + `npx convex run seed:demo`  
8. E2E: `npm run test:e2e`  
9. Layer boundaries note (Layer 2 not included)

- [ ] **Step 2: Commit**

```text
Document Layer 1 local setup Stripe CLI and E2E
```

---

### Task 13: PR into develop

- [ ] **Step 1: Push feature branch** (do not delete any branches)

```powershell
git push -u origin HEAD
gh pr create --base develop --title "Layer 1 renter marketplace" --body "..."
```

- [ ] **Step 2: Ensure commit messages have no em dash and no Cursor co-author** before push (rewrite with `commit-tree` if needed).

- [ ] **Step 3: After review, merge with `gh pr merge <n> --merge` (no `--delete-branch`).

---

## Self-review (spec coverage)

| Spec Layer 1 item | Task |
| ----------------- | ---- |
| Next.js + Convex + Clerk scaffold | 1–3 |
| List-first search + filters + detail | 4 |
| Apply + status through fee outcomes | 5–7 |
| Application fee → platform; webhook truth; idempotency | 6–7, 10 |
| Feature-flagged AI search/Q&A | 9 |
| Demo seed | 8 |
| `.env.example` + README | 3, 12 |
| Playwright golden path + replay | 10 |
| No Connect/landlord/deposit (deferred) | Explicit out of scope |
| No em dash / no co-author / no changelog hand-edits | Commit hygiene + Task 13 |

**Placeholder scan:** No TBD/TODO implementation steps; amounts and status names match schema.  
**Type consistency:** `application_fee`, statuses, and idempotency key `appfee:{id}` match design spec.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-13-layer1-renter-marketplace.md`.

**Hard gate:** Do not scaffold or implement until you explicitly approve this Layer 1 plan.

After approval, two execution options:

1. **Subagent-Driven (recommended)** – fresh subagent per task, review between tasks  
2. **Inline Execution** – execute tasks in this session with checkpoints  

Also remembered: **no agent co-author**, **no feature branch deletion** on merge.
