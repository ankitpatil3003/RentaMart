# RentaMart Layer 5 (Notifications) Implementation Plan

> **Goal:** Notify renters and landlords when application status changes matter (qualified, selected, refund processed, moved in).

**Builds on:** Layer 4 competitive selection on `develop`

**Out of scope:** SMS, push notifications, marketing email (Resend/SendGrid deferred).

---

## Events notified

| Event | Renter | Landlord |
| ----- | ------ | -------- |
| Application fee paid | — | In-app |
| Approved for deposit | In-app | — |
| Qualified | In-app | In-app |
| Selected as tenant | In-app | In-app |
| Not selected | In-app | — |
| Refund completed | In-app | — |
| Moved in | — | In-app |
| Denied | In-app | — |

---

## Implementation

- [x] Schema: `notifications` table + `notificationType` union
- [x] `convex/lib/notificationHelpers.ts` + `convex/notifications.ts`
- [x] Hooks in `applications`, `payments`, `refunds`
- [x] Renter UI: `/notifications`, header badge, applications banner
- [x] Landlord UI: `/landlord/notifications`, nav badge, dashboard card
- [x] E2E smoke (`e2e/layer5-smoke.spec.ts`)

---

## Test plan

1. `npm run typecheck`
2. `npx playwright test e2e/layer5-smoke.spec.ts`
3. Manual: approve application → renter sees notification; pay through qualified → both parties notified; select tenant → winner/loser/landlord notified; refund completes → renter notified; mark moved → landlord notified

---

## Future (Layer 5.1)

- Optional email via Resend/SendGrid (feature-flagged)
- Real-time toast on notification insert (Convex subscription already reactive on list page)
