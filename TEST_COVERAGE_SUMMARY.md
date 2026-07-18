# Test Coverage Summary

## Overview

Comprehensive validation testing across all four workspaces, covering authentication, security utilities, UI components, Pinia stores, composables, and backend routes (public, admin, and consignment/marketplace).

## Test Infrastructure

| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev/) | Test runner (all workspaces) |
| [@vue/test-utils](https://test-utils.vuejs.org/) | Vue component mounting |
| [happy-dom](https://github.com/capricorn86/happy-dom) | Lightweight DOM environment (frontends) |
| [Fastify `.inject()`](https://fastify.dev/docs/latest/Reference/Server/#inject) | In-process HTTP testing (backend) |
| v8 | Coverage provider |

**Coverage reports**: `text` (terminal) + `json` + `html` — run `pnpm test:coverage` in any workspace directory.

---

## Current totals (as of this writing)

| Workspace | Test files | Tests | Notes |
|-----------|-----------|-------|-------|
| `admin-frontend/` | 13 | 290 | includes WebAuthn/password auth store, security utils, page-level tests for every admin page, `useRateLimit`/`useSupabaseAdmin` composables |
| `frontend/` | 13 | 260 | product catalog components, filter/product stores, toast/dark-mode composables |
| `backend/` | 15 | 300 | requires the local Postgres + Redis docker-compose stack — see [Running Tests](#running-tests) below |
| `marketplace/` | 6 | 40 | consignment marketplace composables (`useListings`, `useOffers`, `useSeller`, `useSellerAccount`, `useAuthHeaders`) + `ListingCard.vue` |
| **Total** | **47** | **~890** | |

These counts drift as the codebase grows — run each workspace's `pnpm test` for the authoritative current number rather than trusting this table long-term.

---

## Admin Frontend (`admin-frontend/tests/`)

| File | Covers |
|------|--------|
| `auth.test.ts` | WebAuthn + password login store (`stores/auth.ts`) — validation, WebAuthn error codes, network failures, loading states, SSR safety |
| `security.test.ts` | `utils/security.ts` — `isValidHttpUrl`, `getSafeImageUrl`, `sanitizeText` (URL/XSS/protocol-injection edge cases) |
| `useRateLimit.test.ts` | Client-side rate limiter — attempt window, lockout, reset, per-action isolation |
| `useSupabaseAdmin.test.ts` | Supabase admin CRUD helper — product/category mapping, error propagation, affiliate stats aggregation |
| `darkMode.test.ts` | `useDarkMode` composable |
| `categories.page.test.ts`, `reviews.page.test.ts`, `products.page.test.ts` | Real-SFC-mounted characterization tests for the three admin CRUD pages (pagination, create/edit/delete flows) |
| `login.page.test.ts` | Login page wiring — security-key vs. password mode, store delegation, register flow |
| `diagnostic.page.test.ts` | WebAuthn browser-support diagnostic checks, backend connectivity test |
| `consignment.page.test.ts` | Consignment moderation queue — approve/reject/AI-logs modal |
| `reviews.test.ts`, `nuxt-config.test.ts` | Legacy regression test + Nuxt config assertions |

## User Frontend (`frontend/tests/`)

| File | Covers |
|------|--------|
| `ProductCard.test.ts` | `ProductCard.vue` — both `full`/`simple` variants, discount calculation, ratings, brand tokens, accessibility |
| `SearchBar.test.ts` | Search input, debounce, clear button, loading state, keyboard nav |
| `AffiliateDisclosure.test.ts` | Shared FTC disclosure component (badge/inline/footer variants) |
| `CookieConsent.test.ts` | Cookie consent banner |
| `filters.test.ts`, `stores.test.ts` | `stores/filters.ts` and `stores/products.ts` |
| `useSupabaseProducts.test.ts` | Supabase product-fetching composable |
| `useToast.test.ts`, `darkMode.test.ts` | Toast + dark-mode composables |
| `types.test.ts` | Runtime shape checks for `Product`/`Category`/`ProductFilters` |
| `components/AppAlert.test.ts`, `AppModal.test.ts`, `AppToast.test.ts` | Shared feedback components |

## Marketplace (`marketplace/tests/`)

| File | Covers |
|------|--------|
| `useListings.test.ts` | Listing fetch/create composable |
| `useOffers.test.ts` | Buyer offer composable |
| `useSeller.test.ts`, `useSellerAccount.test.ts` | Seller dashboard + Stripe Connect account composables |
| `useAuthHeaders.test.ts` | Auth header helper |
| `ListingCard.test.ts` | Listing card component |

## Backend (`backend/tests/`)

The backend requires the local docker-compose Postgres + Redis stack (or Supabase connection) — see [Running Tests](#running-tests). Route DI tests inject a mocked `sql`/`redis` client where possible; full-stack tests in `admin.test.js` run against the real database.

| File | Covers |
|------|--------|
| `admin.test.js` | All `admin/*` routes — categories, products, reviews (largest suite) |
| `webauthn.test.js`, `adminAuth.unit.test.js` | WebAuthn registration/auth flows, admin session middleware |
| `products.test.js`, `categories.test.js` | Public product/category routes |
| `consignment-listings.test.js`, `consignment-offers.test.js`, `consignment-moderation.test.js` | Consignment marketplace listing/offer/AI-moderation flows |
| `stripe-webhooks.test.js` | Stripe webhook signature verification and per-event-type handling |
| `security-fixes.test.js`, `image-freshness.test.js`, `relations.unit.test.js`, `sessionStore.test.js`, `app-behavior.test.js` | Targeted regression/unit coverage for specific lib modules |
| `health.test.js` | `GET /health` |

---

## Running Tests

### Admin Frontend / User Frontend / Marketplace

```bash
cd <admin-frontend|frontend|marketplace>
pnpm test                        # Run all tests
pnpm test:watch                  # Watch mode
pnpm test:ui                     # Visual Vitest UI
pnpm test:coverage               # Full coverage report

# Run a specific file
pnpm vitest tests/<file>.test.ts
```

### Backend

```bash
# One-time: start the local Postgres + Redis stack and apply migrations
docker-compose up -d
./scripts/migrate.sh   # or apply supabase/migrations/*.sql directly to a local Postgres

cd backend
pnpm test                        # All backend tests
pnpm test -- webauthn.test.js    # A single file
pnpm test:coverage                # Coverage report (gated at 60% stmt/func/line, 50% branch — see vitest.config.js)
```

---

## Testing Requirements for New Features

All new code must include:

- [ ] Vitest tests with meaningful coverage of the new logic
- [ ] Input validation tests for all user-facing inputs
- [ ] Error handling tests (API failure, network error, malformed response)
- [ ] SSR safety check — no `window`/`document` access at module level (frontends)
- [ ] Edge case tests — null, undefined, empty string, type coercion
- [ ] For security-sensitive code — XSS payloads, protocol injection, HTML injection

---

## Security posture

Historical validation bugs found by an earlier pass of this test suite were triaged and fixed as of 2025-12-12 — see [SECURITY.md](./SECURITY.md) and [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md) for that history. There are no currently-known unfixed vulnerabilities tracked via failing tests; a failing test in this codebase means a regression, not a documented pending bug.

---

**Last updated**: 2026-07-15
