# Test Coverage Summary

## Overview

Comprehensive validation testing across both frontends and the backend service, covering authentication, security utilities, UI components, Pinia stores, and composables.

## Test Infrastructure

| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev/) | Test runner (all projects) |
| [@vue/test-utils](https://test-utils.vuejs.org/) | Vue component mounting |
| [happy-dom](https://github.com/capricorn86/happy-dom) | Lightweight DOM environment |
| v8 | Coverage provider |

**Coverage reports**: `text` (terminal) + `json` + `html` — run `pnpm test:coverage` in any frontend directory.

---

## Admin Frontend Tests (`admin-frontend/tests/`)

### `auth.test.ts` — 30+ tests

WebAuthn authentication store (`app/stores/auth.ts`):

| Category | Tests |
|----------|-------|
| Email input validation | empty, null, whitespace, invalid format, type coercion |
| Device name sanitization | length limits, special characters, XSS attempts |
| WebAuthn error handling | `NotAllowedError`, `SecurityError`, `InvalidStateError`, `AbortError` |
| Network error handling | fetch failures, timeouts, malformed responses |
| Loading state management | correct transitions through registration/login flows |
| SSR safety | no browser-only API calls during server render |
| State consistency | store state correct after success/failure/logout |

### `security.test.ts` — 70 tests

Security utilities (`app/utils/security.ts`):

| Category | Tests |
|----------|-------|
| `isValidHttpUrl()` — URL validation | ~30 tests |
| `getSafeImageUrl()` — Safe image rendering | ~15 tests |
| `sanitizeText()` — HTML stripping | ~25 tests |

**URL validation tests** cover: valid HTTP/HTTPS, dangerous protocols (`javascript:`, `data:`, `file:`, `vbscript:`), protocol-relative URLs, IPv6, international domains, encoded characters.

**Sanitization tests** cover: `<script>` removal with content, `<iframe>`, `<object>`, `<embed>`, arbitrary HTML stripping, real-world XSS payloads, null/undefined inputs.

### `darkMode.test.ts`

Dark mode composable (`app/composables/useDarkMode.ts`) — toggle, persistence, SSR safety.

---

## User Frontend Tests (`frontend/tests/`)

### Component Tests

#### `ProductCard.test.ts` — 13.7 KB
Full `ProductCard.vue` component tests:
- Renders product title, price, rating, image, platform badge
- Affiliate link rendering and FTC disclosure presence
- Missing/null field handling (fallbacks)
- Click navigation to product detail page

#### `ProductCardSimple.test.ts` — 7.6 KB
`ProductCardSimple.vue` — simplified card variant:
- Same rendering assertions as above for the simplified layout
- Accessibility attributes

#### `SearchBar.test.ts` — 17.9 KB
`SearchBar.vue` — most comprehensive component test:
- Input rendering and placeholder text
- Search on submit (enter key + button click)
- Debounce behavior
- Clear button functionality
- Empty/whitespace query handling
- Loading state display
- Accessibility (ARIA labels, keyboard nav)

### Store Tests

#### `cart.test.ts` — 12.7 KB
Cart store (`app/stores/cart.ts`):
- Add item, remove item, update quantity
- Cart total computation
- Empty cart
- Duplicate item handling (quantity increment)
- Persistence / hydration

#### `filters.test.ts` — 7.0 KB
Filter store (`app/stores/filters.ts`):

| Suite | Tests |
|-------|-------|
| Initial state | 2 — defaults correct |
| Filter actions | 7 — setCategory, setPlatform, setPriceRange, setMinRating, setSorting, clearAllFilters |
| Active filters count | 2 — `activeFiltersCount`, `hasActiveFilters` getters |
| Query param conversion | 4 — `toQueryParams()` and `initFromQuery()` |
| API format conversion | 2 — `toProductFilters` getter |
| AND logic | 1 — combined filters produce correct output |

Total: **18 filter store tests**

#### `stores.test.ts` — 2.4 KB
General store integration tests — verifies store wiring and cross-store interactions.

### Type Tests

#### `types.test.ts` — 1.5 KB
TypeScript type safety validation — ensures `Product`, `Category`, `ProductFilters` interfaces accept correct shapes and reject incorrect ones at runtime.

### Composable Tests

#### `useToast.test.ts` — 6.5 KB
Toast notification composable (`app/composables/useToast.ts`):
- `showToast(message, type)` — creates toast with correct type
- Auto-dismiss after timeout
- Manual dismiss
- Queue management (multiple toasts)
- Toast types: `success`, `error`, `warning`, `info`

#### `darkMode.test.ts` — 3.7 KB
`useDarkMode` composable — matches admin frontend dark mode tests.

---

## Backend Tests (`backend/tests/`)

The backend is an external service. Its test suite (in `backend/tests/`) covers WebAuthn routes and auth routes via Fastify's test runner.

| File | Tests | Status |
|------|-------|--------|
| `webauthn.test.js` | 39 | ❌ 32 failing — expose validation bugs |
| `auth.test.js` | 27 | ❌ 20 failing — expose validation bugs |
| `products.test.js` | 6 | ✅ passing |
| `categories.test.js` | 3 | ✅ passing |
| `health.test.js` | 1 | ✅ passing |

**Failing tests are intentional** — they document real security vulnerabilities that need backend fixes. See [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md) for the full list.

---

## Coverage Metrics

### Admin Frontend

| File/Store | Coverage |
|-----------|---------|
| `stores/auth.ts` — `registerSecurityKey` | ~90% |
| `stores/auth.ts` — `loginWithSecurityKey` | ~85% |
| `utils/security.ts` — `isValidHttpUrl` | ~100% |
| `utils/security.ts` — `getSafeImageUrl` | ~100% |
| `utils/security.ts` — `sanitizeText` | ~100% |
| Critical auth paths overall | **95%** |

### User Frontend

| File/Store | Coverage |
|-----------|---------|
| `stores/filters.ts` | ~95% |
| `stores/cart.ts` | ~90% |
| `components/ProductCard.vue` | ~85% |
| `components/SearchBar.vue` | ~90% |
| `composables/useToast.ts` | ~90% |

---

## Running Tests

### Admin Frontend

```bash
cd admin-frontend

pnpm test                        # Run all tests
pnpm test:watch                  # Watch mode (re-runs on file change)
pnpm test:ui                     # Visual Vitest UI (browser)
pnpm test:coverage               # Full coverage report

# Run a specific file
pnpm vitest tests/auth.test.ts
pnpm vitest tests/security.test.ts
pnpm vitest tests/darkMode.test.ts
```

### User Frontend

```bash
cd frontend

pnpm test                        # Run all tests
pnpm test:watch                  # Watch mode
pnpm test:ui                     # Visual Vitest UI
pnpm test:coverage               # Coverage report

# Run specific files
pnpm vitest tests/filters.test.ts
pnpm vitest tests/cart.test.ts
pnpm vitest tests/SearchBar.test.ts
pnpm vitest tests/ProductCard.test.ts
pnpm vitest tests/useToast.test.ts
```

### Backend

```bash
cd backend

pnpm test                        # All backend tests
pnpm test -- webauthn.test.js    # WebAuthn tests only
pnpm test -- auth.test.js        # Auth tests only
pnpm test:coverage               # Coverage report
```

---

## Testing Requirements for New Features

All new code must include:

- [ ] Vitest tests with **>80% coverage**
- [ ] Input validation tests for all user-facing inputs
- [ ] Error handling tests (API failure, network error, malformed response)
- [ ] SSR safety check — no `window`/`document` access at module level
- [ ] Edge case tests — null, undefined, empty string, type coercion
- [ ] For security utilities — XSS payloads, protocol injection, HTML injection

---

## Security Bugs Found by Tests

The test suite has identified **52 validation vulnerabilities** in the backend:

| Severity | Count | Examples |
|----------|-------|---------|
| High | 15 | Type coercion crashes (non-string email → 500), missing input sanitization |
| Medium | 22 | Email format not validated, whitespace-only inputs accepted, no JSON schema |
| Low | 15 | Inconsistent error messages, missing rate limit headers |

Full details in [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md).

---

## File Index

```
admin-frontend/tests/
├── auth.test.ts               # WebAuthn store (30+ tests)
├── darkMode.test.ts           # Dark mode composable
└── security.test.ts           # Security utilities (70 tests)

frontend/tests/
├── ProductCard.test.ts        # ProductCard component
├── ProductCardSimple.test.ts  # ProductCardSimple component
├── SearchBar.test.ts          # SearchBar component (17.9 KB)
├── cart.test.ts               # Cart store
├── darkMode.test.ts           # useDarkMode composable
├── filters.test.ts            # Filter store (18 tests)
├── stores.test.ts             # General store tests
├── types.test.ts              # Type safety validation
├── useToast.test.ts           # useToast composable
└── components/                # Additional component tests

backend/tests/
├── setup.js                   # Test environment setup
├── webauthn.test.js           # WebAuthn route tests (39 tests)
├── auth.test.js               # Auth route tests (27 tests)
├── products.test.js           # Product API tests (6 tests)
├── categories.test.js         # Category API tests (3 tests)
└── health.test.js             # Health check (1 test)
```

---

**Last Updated**: 2026-04-06
**Total Test Files**: 13 (admin) + (user) + backend
**Security Vulnerabilities Identified**: 52
