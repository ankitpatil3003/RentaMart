# RentaMart Layer 3 (Tenant Ops) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship post-move-in tenant operations on top of Layer 2: application-scoped messaging between renters and orgs, monthly rent schedule with Connect Checkout + webhook ledger, and maintenance request tracking.

**Architecture:** Extend the modular monolith. When first-month payment succeeds (`move_in_ready`), create an active `lease` and seed upcoming `rentCharges`. Messaging uses one thread per application (available after submit). Rent reuses the payments/webhook pattern with idempotency `rent:{leaseId}:{YYYY-MM}`. Maintenance requests tie to leases; renters create, org staff update status.

**Tech Stack:** Next.js App Router, Convex (real-time queries), Clerk, Stripe Connect test mode, Playwright smoke extension.

**Spec:** `docs/superpowers/specs/2026-07-13-rentamart-design.md`  
**Builds on:** Layer 1 + Layer 2 on `develop`

**Out of scope:** Maps, production live Stripe, real CRA vendor, mobile apps, recurring Stripe subscriptions (use one-off Checkout per month).

**Commit hygiene (always):** No em dash in commit messages. Never add `Co-authored-by: Cursor`. Never hand-edit auto-generated changelogs. Do not delete feature branches on merge.

**Prerequisite:** Layer 2 merged (landlord portal, deposit/first month, `move_in_ready`).

---

## File structure (locked for Layer 3)

```
app/
  messages/page.tsx
  messages/[applicationId]/page.tsx
  rent/page.tsx
  maintenance/page.tsx
  landlord/messages/page.tsx
  landlord/rent/page.tsx
  landlord/maintenance/page.tsx

components/
  messages/MessageThread.tsx
  messages/MessageThreadList.tsx
  rent/RentSchedule.tsx
  maintenance/MaintenanceList.tsx
  maintenance/MaintenanceForm.tsx
  landlord/LandlordNav.tsx          # add Messages, Rent, Maintenance links

convex/
  schema.ts                         # leases, messageThreads, messages, rentCharges, maintenanceRequests
  lib/money.ts                      # rentIdempotencyKey
  leases.ts                         # NEW
  messages.ts                       # NEW
  rent.ts                           # NEW
  maintenance.ts                    # NEW
  payments.ts                       # rent payment type + webhook hook
  paymentsActions.ts                # createRentCheckout, sync

middleware.ts                       # protect /messages, /rent, /maintenance

e2e/layer3-smoke.spec.ts
README.md
```

---

### Task 1: Schema + lease on move_in_ready

**Tables:**

- `leases`: applicationId (unique index), listingId, orgId, renterUserId, rentCents, dueDayOfMonth, startDate, status (`active` | `ended`)
- `messageThreads`: applicationId (unique), orgId, renterUserId, lastMessageAt
- `messages`: threadId, senderUserId, body, createdAt
- `rentCharges`: leaseId, periodKey (`YYYY-MM`), dueDate, amountCents, status (`due` | `checkout_open` | `paid` | `failed`)
- `maintenanceRequests`: leaseId, orgId, renterUserId, title, description, priority, status (`open` | `in_progress` | `resolved`)

Extend `paymentType` with `rent`. Add optional `rentChargeId` on `payments`.

On `move_in_ready` in `applyStripeCheckoutEvent`, call `internal.leases.ensureFromApplication`.

---

### Task 2: Messaging

- `messages.getOrCreateThread(applicationId)` for renter
- `messages.listThreadsForRenter` / `listThreadsForOrg`
- `messages.listMessages(threadId)` paginated or capped collect
- `messages.send(threadId, body)` with participant check
- UI: `/messages`, `/messages/[applicationId]`, `/landlord/messages?orgId=`

---

### Task 3: Rent schedule + payments

- `rent.listForRenter`, `rent.listForOrg`
- `rent.ensureChargesForLease` internal (3 months ahead)
- `paymentsActions.createRentCheckout({ rentChargeId })`
- Webhook success marks charge `paid`; idempotency `rent:{leaseId}:{periodKey}`
- UI: `/rent`, `/landlord/rent?orgId=`

---

### Task 4: Maintenance

- `maintenance.create(leaseId, title, description, priority)`
- `maintenance.listForRenter` / `listForOrg`
- `maintenance.updateStatus` org mutation
- UI: `/maintenance`, `/landlord/maintenance?orgId=`

---

### Task 5: Nav, seed touch-up, README, E2E smoke

- Site header: Messages, Rent, Maintenance for signed-in renters with active lease/thread
- Landlord nav links
- README Layer 3 section
- Playwright smoke: pages load when signed in (skip if no E2E secrets)

---

## Self-review

| Spec requirement | Task |
| ---------------- | ---- |
| Messaging | Task 2 |
| Rent schedule | Task 3 |
| Maintenance | Task 4 |
| Webhook truth for rent | Task 3 |
| RBAC / auth | All tasks |
