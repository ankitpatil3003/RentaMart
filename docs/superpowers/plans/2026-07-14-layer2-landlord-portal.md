# RentaMart Layer 2 (Landlord Portal + Connect) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship landlord/org operations on top of Layer 1: Stripe Connect test onboarding, org RBAC, self-serve listings with publish gates, application review (approve/deny), deposit + first month via Connect Checkout with webhook ledger, stub screening + AI assist (no decisions), and Playwright E2E extended through deposit/first month + webhook replay.

**Architecture:** Extend the Layer 1 modular monolith. Clerk identity unchanged; Convex adds `orgQuery`/`orgMutation` wrappers for org-scoped RBAC. Landlord UI under `/landlord/*`. On `fee_paid`, applications enter `under_review`. Approve moves to `deposit_due`; deposit webhook success moves to `first_month_due`; first month webhook success moves to `move_in_ready`. Denied is terminal. Same webhook-as-truth pattern as Layer 1 with idempotency keys `deposit:{applicationId}` and `first_month:{applicationId}`.

**Tech Stack:** Next.js App Router, Convex, Clerk, Stripe Connect (test mode + CLI), Playwright, optional Groq for screening assist DTOs.

**Spec:** `docs/superpowers/specs/2026-07-13-rentamart-design.md`  
**Builds on:** `docs/superpowers/plans/2026-07-13-layer1-renter-marketplace.md` (Layer 1 code on `feat/layer1-renter-marketplace` / PR #3)

**Out of scope (Layer 3+):** Messaging, rent schedule, maintenance, maps, production live Stripe, real CRA vendor, mobile apps.

**Commit hygiene (always):** No em dash in commit messages. Never add `Co-authored-by: Cursor` (rewrite with `git commit-tree` if injected). Never hand-edit auto-generated changelogs. Prefer quality and maintainability. Do not delete feature branches on merge.

**Hard gate:** Do not implement Layer 2 code until this plan is approved.

**Prerequisite:** Layer 1 merged or available on your working branch (search, apply, application fee, webhook ledger).

---

## File structure (locked for Layer 2)

```
app/
  landlord/
    layout.tsx                     # org nav shell; requires org member
    page.tsx                       # dashboard summary
    connect/page.tsx               # Connect onboarding status + link
    listings/page.tsx              # org listings list
    listings/new/page.tsx          # create draft listing
    listings/[id]/edit/page.tsx    # edit + publish/unpublish
    applications/page.tsx          # inbox: fee_paid / under_review
    applications/[id]/page.tsx   # review, screening stub, approve/deny

components/
  landlord/
    LandlordNav.tsx
    ConnectStatus.tsx
    ListingEditor.tsx
    ApplicationReview.tsx
    ScreeningStubPanel.tsx
    ScreeningAssist.tsx              # AI DTOs only; no approve/deny
  applications/
    ApplicationStatus.tsx            # extend: deposit + first month CTAs
  listings/
    ListingDetail.tsx                # optional: show org name when published

convex/
  schema.ts                        # add screeningReports; listing deposit fields
  lib/
    customFunctions.ts             # add orgQuery, orgMutation, orgOwnerMutation
    auth.ts                        # requireOrgMember, requireOrgRole
    money.ts                       # deposit/firstMonth idempotency keys
  orgs.ts                          # NEW: org CRUD, membership, connect flags
  orgsActions.ts                   # NEW: "use node" Connect AccountLink + account.updated
  listings.ts                      # landlord mutations + publish gate
  applications.ts                  # under_review transitions, approve/deny
  payments.ts                      # deposit + first_month internal + queries
  paymentsActions.ts               # Connect Checkout sessions
  screening.ts                     # NEW: stub vendor-shaped adapter
  screeningActions.ts              # optional stub "submit" action
  ai.ts / aiActions.ts             # screeningAssist DTO (no status writes)
  seed.ts                          # Connect-ready demo org + org_owner member
  http.ts                          # handle account.updated if needed via webhook

e2e/
  golden-path-layer2.spec.ts       # full path through move_in_ready
  webhook-replay-layer2.spec.ts    # deposit replay idempotency

.env.example                       # STRIPE_CONNECT_* notes
README.md                          # landlord setup, Connect test, E2E
```

---

### Task 1: Schema additions + fee_paid to under_review

**Files:**
- Modify: `convex/schema.ts`, `convex/payments.ts` (`applyStripeCheckoutEvent`)

Layer 1 already has org/listing/application/payment tables. Add:

```ts
// convex/schema.ts additions on listings
depositCents: v.number(),           // default = rentCents at create time
firstMonthCents: v.number(),        // default = rentCents

// new table
screeningReports: defineTable({
  applicationId: v.id("applications"),
  vendorRef: v.string(),
  status: v.union(
    v.literal("not_started"),
    v.literal("pending"),
    v.literal("complete"),
    v.literal("failed"),
  ),
  summary: v.optional(v.string()),
  missingDocs: v.array(v.string()),
  requestedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
})
  .index("by_application", ["applicationId"]),
```

- [ ] **Step 1: Patch schema and push**

```powershell
$env:CONVEX_AGENT_MODE='anonymous'
npx convex dev --once
```

- [ ] **Step 2: Auto-transition on application fee success**

In `applyStripeCheckoutEvent`, when setting application `fee_paid`, also set `under_review` (or set `under_review` in a dedicated internal mutation called immediately after fee_paid). Preferred single patch:

```ts
await ctx.db.patch(payment.applicationId, {
  status: "under_review",
});
```

Use `under_review` directly instead of intermediate `fee_paid` display if you want one step; renter UI should still show "Application fee paid" copy when status is `under_review` (update `statusLabel` / `ApplicationStatus.tsx`).

- [ ] **Step 3: Backfill seed listings with deposit/firstMonth fields** in `convex/seed.ts`.

- [ ] **Step 4: Commit**

```text
Add Layer 2 schema fields and fee paid to under review transition
```

---

### Task 2: Org RBAC wrappers + orgs module

**Files:**
- Create: `convex/orgs.ts`
- Modify: `convex/lib/auth.ts`, `convex/lib/customFunctions.ts`

- [ ] **Step 1: Auth helpers**

```ts
// convex/lib/auth.ts
export async function requireOrgMember(
  ctx: Ctx,
  orgId: Id<"orgs">,
  user: Doc<"users">,
): Promise<Doc<"orgMembers">> {
  const member = await ctx.db
    .query("orgMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("orgId", orgId).eq("userId", user._id),
    )
    .unique();
  if (!member) throw new Error("Not a member of this organization");
  return member;
}

export async function requireOrgRole(
  ctx: Ctx,
  orgId: Id<"orgs">,
  user: Doc<"users">,
  allowed: Array<"org_owner" | "leasing_agent">,
) {
  const member = await requireOrgMember(ctx, orgId, user);
  if (!allowed.includes(member.role)) {
    throw new Error("Insufficient organization permissions");
  }
  return member;
}
```

- [ ] **Step 2: Custom wrappers**

```ts
export const orgQuery = customQuery(authedQuery, {
  args: { orgId: v.id("orgs") },
  input: async (ctx, args) => {
    const member = await requireOrgMember(ctx, args.orgId, ctx.user);
    return { ctx: { ...ctx, orgId: args.orgId, orgRole: member.role }, args };
  },
});
```

Mirror `orgMutation`; add `orgOwnerMutation` requiring `org_owner`.

- [ ] **Step 3: `convex/orgs.ts` public API**

| Function | Who | Returns |
| -------- | --- | ------- |
| `create` | authed user | `orgId` + inserts self as `org_owner` |
| `listMine` | authed | orgs where user is member |
| `get` | org member | org + `connectReady` + `stripeConnectAccountId` set? |
| `inviteMember` | org_owner | add `leasing_agent` by email (lookup user) |

Never expose Connect secret keys to client.

- [ ] **Step 4: Commit**

```text
Add org RBAC wrappers and organization membership APIs
```

---

### Task 3: Stripe Connect onboarding (test mode)

**Files:**
- Create: `convex/orgsActions.ts`
- Modify: `convex/orgs.ts`, `convex/http.ts` or account webhook handler
- Modify: `.env.example`

- [ ] **Step 1: Env vars**

```env
STRIPE_SECRET_KEY=sk_test_...
# Connect uses same secret in test mode
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 2: Create Connect account + Account Link**

`orgsActions.createConnectOnboardingLink`:

```ts
"use node";
// 1. org_owner only (via internal prep mutation)
// 2. If no stripeConnectAccountId, stripe.accounts.create({ type: "express", country: "US", capabilities: { card_payments: { requested: true }, transfers: { requested: true } } })
// 3. Save account id on org
// 4. stripe.accountLinks.create({ account, refresh_url, return_url, type: "account_onboarding" })
// 5. Return { url }
```

Return URLs: `/landlord/connect?refresh=1` and `?return=1`.

- [ ] **Step 3: Mark `connectReady`**

On return page, call `orgs.syncConnectStatus` action that fetches account via Stripe API and sets:

```ts
connectReady =
  account.charges_enabled === true &&
  account.payouts_enabled === true &&
  account.details_submitted === true;
```

Optional: handle `account.updated` webhook (extend `http.ts` or `paymentsActions.verifyAndApplyWebhook`) to patch org when Stripe notifies.

- [ ] **Step 4: UI** `app/landlord/connect/page.tsx` + `ConnectStatus.tsx`

Show: not started / onboarding incomplete / ready (test). CTA "Complete Stripe setup".

- [ ] **Step 5: Commit**

```text
Add Stripe Connect test onboarding for landlord organizations
```

---

### Task 4: Landlord listing self-serve + publish gate

**Files:**
- Modify: `convex/listings.ts`
- Create: `components/landlord/ListingEditor.tsx`, landlord listing routes

- [ ] **Step 1: Mutations (org-scoped)**

| Mutation | Role | Rules |
| -------- | ---- | ----- |
| `createDraft` | org_owner or leasing_agent | `published: false`, set `depositCents`/`firstMonthCents` defaults from `rentCents` |
| `update` | org member | cannot publish here |
| `publish` | org_owner | **requires `org.connectReady === true`**, validates required fields (title, rent, city, state, zip, at least one photo URL) |
| `unpublish` | org_owner | sets `published: false` |

- [ ] **Step 2: Queries**

`listForOrg` (paginated, org member), `getForOrgEdit` (includes unpublished).

- [ ] **Step 3: Listing editor UI**

One job per screen: create form, edit form, publish button disabled with reason when Connect not ready.

- [ ] **Step 4: Manual test**

Create draft while Connect not ready; publish blocked. Complete Connect test onboarding; publish succeeds; appears on public `/listings`.

- [ ] **Step 5: Commit**

```text
Add landlord listing CRUD with Connect publish gate
```

---

### Task 5: Application review (approve / deny)

**Files:**
- Modify: `convex/applications.ts`
- Create: `components/landlord/ApplicationReview.tsx`, landlord application routes

- [ ] **Step 1: Org-scoped queries**

`listInboxForOrg`: applications for listings in org where status in `under_review` (and optionally `fee_paid` if you keep both).

`getForOrgReview`: application + listing snapshot + renter contact fields + payment summaries.

- [ ] **Step 2: Mutations (human only, not AI)**

```ts
export const approve = orgOwnerMutation({
  args: { applicationId: v.id("applications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // verify application.listing.orgId === ctx.orgId
    // status must be under_review
    await ctx.db.patch(args.applicationId, { status: "deposit_due" });
    return null;
  },
});

export const deny = orgOwnerMutation({
  args: { applicationId: v.id("applications"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // status must be under_review
    await ctx.db.patch(args.applicationId, { status: "denied" });
    // optional: store deny reason on application later; YAGNI: skip field unless needed
    return null;
  },
});
```

`leasing_agent` may be read-only in Layer 2 unless you add `approve` for both roles (spec: leasing_agent does review ops; allow approve/deny for `org_owner` and `leasing_agent`).

- [ ] **Step 3: Landlord review UI**

Inbox table + detail page with Approve / Deny buttons. No payment buttons on landlord side for deposit (renter pays).

- [ ] **Step 4: Commit**

```text
Add landlord application review approve and deny flows
```

---

### Task 6: Deposit + first month Connect Checkout + webhooks

**Files:**
- Modify: `convex/lib/money.ts`, `convex/payments.ts`, `convex/paymentsActions.ts`
- Modify: `components/applications/ApplicationStatus.tsx`

- [ ] **Step 1: Idempotency keys**

```ts
export function depositIdempotencyKey(applicationId: Id<"applications">) {
  return `deposit:${applicationId}`;
}
export function firstMonthIdempotencyKey(applicationId: Id<"applications">) {
  return `first_month:${applicationId}`;
}
```

- [ ] **Step 2: Prepare checkout internal mutations**

Mirror `prepareApplicationFeeCheckout`:

- `prepareDepositCheckout`: requires application `deposit_due`, loads listing `depositCents` + org `stripeConnectAccountId`, creates payment row type `deposit`.
- `prepareFirstMonthCheckout`: requires `first_month_due`, amount `firstMonthCents`.

- [ ] **Step 3: Stripe Checkout with Connect destination**

```ts
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [/* ... */],
  payment_intent_data: {
    transfer_data: {
      destination: org.stripeConnectAccountId!,
    },
  },
  metadata: {
    applicationId,
    paymentId,
    type: "deposit", // or first_month
    idempotencyKey,
  },
}, { idempotencyKey });
```

Platform may keep application fee on platform account; deposit/first month go to Connect account per spec.

- [ ] **Step 4: Extend `applyStripeCheckoutEvent`**

On success:

| type | application status |
| ---- | -------------------- |
| `deposit` | `deposit_paid` then `first_month_due` (patch both in same webhook handler after deposit succeeds) |
| `first_month` | `first_month_paid` then `move_in_ready` |

On failure: keep application in `deposit_due` or `first_month_due`; payment `failed`.

- [ ] **Step 5: Renter UI**

`ApplicationStatus.tsx`:

- `deposit_due`: Pay deposit CTA
- `first_month_due`: Pay first month CTA
- `move_in_ready`: success copy

Extend `getByApplication` or add `listPaymentsForApplication` returning all payment types for ledger display.

- [ ] **Step 6: Commit**

```text
Add Connect deposit and first month checkout with webhook ledger
```

---

### Task 7: Screening stub + AI assist (no decisions)

**Files:**
- Create: `convex/screening.ts`, `convex/screeningActions.ts`
- Create: `components/landlord/ScreeningStubPanel.tsx`, `components/landlord/ScreeningAssist.tsx`
- Modify: `convex/aiActions.ts` or new `screeningAssist` action

- [ ] **Step 1: Vendor-shaped stub**

```ts
// convex/screening.ts
export const requestStubScreening = orgMutation({
  args: { applicationId: v.id("applications") },
  returns: v.id("screeningReports"),
  handler: async (ctx, args) => {
    // verify org owns listing for application
    // insert screeningReports { status: "pending", vendorRef: `stub:${applicationId}`, missingDocs: [] }
    // immediately patch to complete with sandbox summary (or schedule internalMutation after 2s for demo realism)
    return reportId;
  },
});

export const getForApplication = orgQuery({
  args: { applicationId: v.id("applications") },
  returns: v.union(/* screening report object */, v.null()),
  handler: async (ctx, args) => { /* ... */ },
});
```

Stub forever: no external CRA.

- [ ] **Step 2: AI screening assist DTO**

```ts
export const screeningAssist = action({
  args: { applicationId: v.id("applications"), reportId: v.id("screeningReports") },
  returns: v.object({
    summary: v.string(),
    missingDocs: v.array(v.string()),
    suggestedQuestions: v.array(v.string()),
    disabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // AI_ENABLED gate
    // Read report + application snapshot only
    // NEVER call approve/deny mutations
    // Return DTO for UI
  },
});
```

- [ ] **Step 3: Landlord UI panel**

Show stub report status, "Run sandbox screening" button, AI assist box (feature-flagged). Approve/Deny remain human-only buttons.

- [ ] **Step 4: Commit**

```text
Add stub screening vendor interface and AI assist without decisions
```

---

### Task 8: Landlord portal shell + navigation

**Files:**
- Create: `app/landlord/layout.tsx`, `app/landlord/page.tsx`, `components/landlord/LandlordNav.tsx`
- Modify: `middleware.ts` (protect `/landlord(.*)`)

- [ ] **Step 1: Layout**

If user has no orgs, show "Create organization" CTA calling `orgs.create`.

If multiple orgs, org switcher in nav (store selected org in URL query `?orgId=` or cookie; prefer URL).

- [ ] **Step 2: Dashboard cards**

Counts: draft listings, published listings, applications in review, Connect status.

- [ ] **Step 3: Site header link**

Add "Landlord" link when user has org membership (query `orgs.listMine`).

- [ ] **Step 4: Commit**

```text
Add landlord portal layout navigation and dashboard
```

---

### Task 9: Seed + demo path for Layer 2 E2E

**Files:**
- Modify: `convex/seed.ts`

- [ ] **Step 1: Extend `seed.demo`**

- Create `orgMembers` row linking demo landlord user to Demo Homes LLC as `org_owner` (accept `landlordUserId` arg or use env `SEED_LANDLORD_CLERK_ID`)
- Set `depositCents` / `firstMonthCents` on listings
- Document: for Connect-ready seed, run Connect onboarding once in test mode OR set `stripeConnectAccountId` + `connectReady: true` via Convex dashboard in dev only

- [ ] **Step 2: Optional `seed.layer2DemoAccounts`**

Internal mutation to attach test Connect account id from env `STRIPE_TEST_CONNECT_ACCOUNT_ID` for CI/E2E.

- [ ] **Step 3: Commit**

```text
Extend demo seed for landlord org membership and Layer 2 amounts
```

---

### Task 10: Playwright E2E Layer 2 golden path + replay

**Files:**
- Create: `e2e/golden-path-layer2.spec.ts`, `e2e/webhook-replay-layer2.spec.ts`
- Modify: `playwright.config.ts` if needed

- [ ] **Step 1: Golden path (gated on secrets)**

With `E2E_LAYER2=1`:

1. Renter path from Layer 1 through `under_review` (fee webhook)
2. Landlord signs in (storageState), opens inbox, runs stub screening, approves
3. Renter pays deposit (Checkout test card), webhook -> `first_month_due`
4. Renter pays first month, webhook -> `move_in_ready`
5. Assert UI labels and ledger rows for three payment types

Be picky about UI copy and spacing; fix visual issues found.

- [ ] **Step 2: Webhook replay**

POST same signed `checkout.session.completed` for deposit twice; assert single succeeded payment and correct application status.

- [ ] **Step 3: Run**

```powershell
npx playwright install chromium
$env:E2E_LAYER2='1'
npm run test:e2e
```

- [ ] **Step 4: Commit**

```text
Add Layer 2 Playwright golden path and webhook replay tests
```

---

### Task 11: README, env example, lint

- [ ] **Step 1: README** sections for landlord portal, Connect test onboarding, org creation, E2E_LAYER2.

- [ ] **Step 2: `.env.example`** add optional `STRIPE_TEST_CONNECT_ACCOUNT_ID`, `SEED_LANDLORD_CLERK_ID`.

- [ ] **Step 3: `npm run check`** must pass. Lint warnings in `_generated` are acceptable; fix real issues.

- [ ] **Step 4: Commit**

```text
Document Layer 2 landlord Connect setup and E2E
```

---

### Task 12: PR into develop

- [ ] **Step 1: Push branch** (keep feature branches)

```powershell
git push -u origin HEAD
gh pr create --base develop --title "Add Layer 2 landlord portal implementation plan" --body "..."
```

- [ ] **Step 2: Verify no em dash and no Cursor co-author** on commits.

- [ ] **Step 3: After plan approval, implement on `feat/layer2-landlord-portal` branched from latest develop (or Layer 1 branch if not merged yet).

- [ ] **Merge with** `gh pr merge <n> --merge` **without** `--delete-branch`.

---

## Self-review (spec coverage)

| Spec Layer 2 item | Task |
| ----------------- | ---- |
| Orgs + Connect onboarding (test) | 2, 3 |
| RBAC org_owner / leasing_agent | 2 |
| Landlord self-list + publish gates | 4 |
| Review approve/deny | 5 |
| deposit + first_month via Connect + webhooks | 6 |
| Status machine through move_in_ready | 1, 5, 6 |
| Screening stub + AI assist (no decisions) | 7 |
| E2E deposit/first month + replay | 10 |
| Demo seed updates | 9 |
| Layer 3 deferred | Out of scope |

**Placeholder scan:** No TBD steps; idempotency keys match design spec.  
**Type consistency:** Uses existing `paymentType`, `applicationStatus`, `orgs.connectReady` from Layer 1 schema.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-14-layer2-landlord-portal.md`.

**Hard gate:** Do not implement until you approve this Layer 2 plan.

After approval:

1. **Subagent-Driven (recommended)** – fresh subagent per task, review between tasks  
2. **Inline Execution** – execute in this session with checkpoints  

**Note:** Layer 1 PR #3 is still open on GitHub. You can merge it first, or implement Layer 2 on a branch that includes Layer 1 commits.
