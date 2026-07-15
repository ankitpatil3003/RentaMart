# RentaMart Layer 4 (Competitive Selection) Implementation Plan

> **Goal:** Landlords see all applicants, choose the best qualified tenant (not FCFS), process refunds for non-selected applicants, and confirm move-in.

**Architecture:** Extend application status machine with `qualified` → landlord `selectApplicant` → `move_in_ready` → `markMoved`. First-month payment no longer auto-creates lease; lease + rent charges start on selection. Refunds table + Stripe Connect `reverse_transfer` for deposit/first month only.

**Builds on:** Layers 1–3 on `develop`

**Out of scope:** Application fee refunds, production Stripe live mode, automated CRA screening, email notifications.

---

## Status machine (Layer 4)

```
… → first_month_due → qualified → move_in_ready → moved
                           ↓
                  refund_eligible → refunded
```

- **qualified:** Deposit + first month paid; awaiting landlord selection
- **move_in_ready:** Landlord selected this applicant; lease created
- **moved:** Keys handed over (landlord confirms)
- **refund_eligible / refunded:** Non-selected applicants who paid deposit and/or first month

Application fee is **non-refundable** (US screening norm).

---

## Backend

| Module | Functions |
| ------ | --------- |
| `applications.ts` | `listAllForOrg`, `selectApplicant`, `markMoved`, payment summaries |
| `payments.ts` | First month success → `qualified` (not `move_in_ready`) |
| `refunds.ts` | `processForApplication`, `prepareRefundRows`, `listEligibleForOrg` |
| `refundsActions.ts` | Stripe refund with `reverse_transfer` |

---

## Landlord UI

- `/landlord/applications` — all applicants with payment badges
- Application detail — approve, select tenant, mark moved, process refund

## Renter UI

- Status copy for `qualified`, `refund_eligible`, `refunded`, `moved`

---

## Layer 4.1 (hardening)

- [x] Unpublish listing when tenant selected; block new applications
- [x] Auto-schedule refunds on selection
- [x] Landlord dashboard stats (qualified, refunds pending)
- [x] E2E smoke (`e2e/layer4-smoke.spec.ts`)
- [x] README money path update

---

## Test plan

1. **Typecheck:** `npm run typecheck`
2. **Smoke E2E:** `npm run test:e2e` (public + layer3 + layer4)
3. **Manual (Stripe test):**
   - Two renters apply to same listing, complete fee → approve → deposit → first month
   - Landlord sees both as **Qualified**
   - Select one → winner **Move-in ready**, loser **Refund eligible**
   - Process refund → **Refunded**
   - Mark winner **Moved in**
4. **Webhook replay:** Refund idempotency via `refund:{paymentId}` keys

---

## Commit hygiene

No em dash in commit messages. No agent co-author trailers.
