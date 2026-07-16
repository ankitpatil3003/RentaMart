# RentaMart Layer 5.1 (Email + Toasts)

> **Goal:** Optional Resend email for each notification, plus live in-app toasts when new unread notifications arrive.

**Builds on:** Layer 5 on `develop` / `main`

---

## Implementation

- [x] `emailSentAt` on `notifications` (idempotent email send)
- [x] `convex/emailActions.ts` — Resend via fetch; gated by `EMAIL_ENABLED`
- [x] Schedule email after each notification insert
- [x] `NotificationToasts` in app providers (hydrate then toast new unread only)
- [x] `.env.example` + README setup
- [x] Smoke: existing layer5 auth tests still apply

## Env (Convex)

```bash
npx convex env set EMAIL_ENABLED true
npx convex env set RESEND_API_KEY re_...
# optional
npx convex env set EMAIL_FROM "RentaMart <onboarding@resend.dev>"
npx convex env set NEXT_PUBLIC_APP_URL http://localhost:3000
```

## Test plan

1. `npm run typecheck`
2. `npx playwright test e2e/layer5-smoke.spec.ts`
3. With email off: approve an application → renter toast appears; no Resend call
4. With email on + Resend test key: same flow → email delivered to renter address
5. Replay: second email attempt for same notification is skipped (`emailSentAt`)
