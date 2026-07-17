# Changelog

All notable changes to RentaMart are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2026-07-17

### Added

- Trusted-org listing fast-path: Connect-ready orgs with enough prior approved listings (default 3) and no denials auto-approve authenticity on submit
- Landlord dashboard shows listing-review trust status; editor copy distinguishes auto-approve vs standard review
- Convex env `TRUSTED_ORG_MIN_APPROVED_LISTINGS` (optional; default 3)

### Upgrade notes

1. No required production env change (default threshold is 3)
2. Optional: `npx convex env set TRUSTED_ORG_MIN_APPROVED_LISTINGS N` if you want a different threshold

## [1.5.0] - 2026-07-17

### Added

- Authenticated trust-path Playwright golden path (`e2e/trust-path.spec.ts`) via `@clerk/testing`: become-landlord → admin approve → listing authenticity review → publish
- Dev-only Convex helper `e2eHelpers.markOrgConnectReady` gated by `E2E_MODE=true` so publish can skip Stripe Connect onboarding in local/CI demos
- `npm run test:e2e:trust` and README setup for applicant + admin Clerk test users
- Project `CHANGELOG.md` covering releases from v1.0.0

### Upgrade notes

1. Keep Convex `E2E_MODE` unset (or false) on production; enable only on dev/demo deployments used for Playwright
2. Optional: configure Clerk applicant/admin test users and run `npm run test:e2e:trust` against a non-production Convex deployment

## [1.4.0] - 2026-07-17

### Added

- Org invite accept flow: owners invite verified users from `/landlord/team`; invitees accept/decline at `/invites`
- Pending invites (not immediate membership) via `orgInvites` plus Team / Invites nav
- Trust-path Playwright smoke for protected admin/landlord routes

### Upgrade notes

1. Run `npx convex deploy` so production gets the `orgInvites` schema and invite APIs
2. Confirm Team and Invites links appear for landlords / invitees after deploy

## [1.3.0] - 2026-07-17

### Added

- Entitlement gates for remaining open surfaces: admin redirect, conditional header nav, message access contracts, owner-only Connect/publish, verified org invites
- Unauthorized application/message detail routes redirect away instead of showing empty shells

## [1.2.1] - 2026-07-17

### Added

- Homepage secondary CTA: Become a landlord → `/become-landlord`, next to Browse listings

## [1.2.0] - 2026-07-17

### Added

- Landlord request/approve: users request access at `/become-landlord` with documents; `platform_admin` approves at `/admin/landlord-requests`. Self-serve org creation is closed
- Listing authenticity review: listings must be submitted for review and approved at `/admin/listings` before publish (still requires Stripe Connect readiness)
- Docs: Vercel first-time deploy checklist and visitor demo walkthrough

### Security

- `screeningAssist` requires org membership
- `seed.demo` is platform_admin-only
- Public self-promote admin mutation removed

### Upgrade notes

1. Bootstrap the first `platform_admin` via Convex dashboard or `internal.seed.promoteUserToPlatformAdmin`
2. Do not set `SEED_ALLOW_UNAUTH` in production
3. Existing published listings without `verificationStatus` are treated as approved; new publishes need review

## [1.1.0] - 2026-07-16

### Added

- GitHub Actions CI on `develop` and `main` (typecheck, Next.js build, Playwright smoke when Clerk secrets are set)
- `vercel.json` for Next.js on Vercel
- README: CI secrets and Vercel + Convex production deploy steps
- `npm run test:e2e:smoke` for public and auth-redirect smoke tests

## [1.0.0] - 2026-07-16

First production-ready milestone for RentaMart (Next.js, Convex, Clerk, Stripe test mode).

### Added

#### Layer 1: Renter marketplace

- Public listing search and detail
- Apply flow with application fee via Stripe Checkout
- Webhook-driven payment ledger updates (idempotent)

#### Layer 2: Landlord portal

- Org-scoped landlord dashboard and listings
- Stripe Connect onboarding (test mode)
- Application approve/deny review
- Deposit and first-month rent collection via Connect destination charges
- Screening stub/sandbox only (not live screening)

#### Layer 3: Tenant operations

- Messaging between renter and landlord
- Rent schedule
- Maintenance requests

#### Layer 4: Competitive tenant selection

- Select one applicant per US rental norms
- Automatic deposit/first-month refunds for non-selected applicants
- Application fee remains non-refundable
- Move-in confirmation path
- Listing unpublish on selection

#### Layer 5 + 5.1: Notifications

- In-app notifications with unread badges
- Live toast UI for new notifications
- Optional feature-flagged Resend email (`EMAIL_ENABLED`)

### Notes

- Stripe is test mode only
- Screening is stub/sandbox only
- Email requires `EMAIL_ENABLED=true` and `RESEND_API_KEY`

[Unreleased]: https://github.com/ankitpatil3003/RentaMart/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.6.0
[1.5.0]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.5.0
[1.4.0]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.4.0
[1.3.0]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.3.0
[1.2.1]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.2.1
[1.2.0]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.2.0
[1.1.0]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.1.0
[1.0.0]: https://github.com/ankitpatil3003/RentaMart/releases/tag/v1.0.0
