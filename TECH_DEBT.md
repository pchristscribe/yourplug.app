# Tech Debt Audit — yourplug App

**Audit date:** 2026-07-12
**Scope:** Full codebase (admin-frontend, frontend, marketplace, backend, mcp-dhgate, infra/CI, docs)
**Scoring:** Priority = (Impact + Risk) × (6 − Effort) — higher is worse/more urgent

**Supersedes:** the 2026-05-10 audit previously in this file. That audit's top findings (Redis wildcard `DEL`, unvalidated Prisma body, `useRateLimit` at module scope, backend excluded from CI, Node version mismatch, search filter injection, missing dependabot config, console.log leaking auth internals) were verified fixed as of this audit — the backend has since fully migrated from Prisma to `postgres-js`. See git history (`git log --oneline --all | grep -i prisma`) for that migration.

---

## Critical findings (fix this sprint)

### 1. `marketplace/` workspace has no lockfile and zero CI coverage
**Category:** Infra/Dependencies · **Impact:** 5 · **Risk:** 5 · **Effort:** 2 · **Priority:** 40

`marketplace/` is a fully built, tested, Railway-deployed Nuxt app with no `pnpm-lock.yaml`, while every sibling workspace (`admin-frontend`, `frontend`, `backend`, `mcp-dhgate`) carries its own. Its `railway.json` still runs `pnpm install --frozen-lockfile`, which will fail outright on the next deploy. It's also absent from `ci.yml`/`test.yml`/`eslint.yml` matrices and from `README.md`'s project structure, so it ships with no automated regression protection at all.

**Fixed:** `marketplace/pnpm-lock.yaml` generated and verified against `--frozen-lockfile`; added to `ci.yml`'s security-audit/test/build matrices and `test.yml`'s test jobs; documented in `README.md`/`CLAUDE.md`. **Not done:** `marketplace/` has no ESLint config or `eslint` dependency at all (unlike `frontend`/`admin-frontend`), so it isn't in `eslint.yml` — wiring it in means building a lint config from scratch and fixing whatever it finds, deliberately left as a separate follow-up rather than rushed in.

---

### 2. Zero test coverage on payment-critical backend routes
**Category:** Test · **Impact:** 5 · **Risk:** 5 · **Effort:** 3 · **Priority:** 30

`backend/src/routes/stripe-webhooks.js` and `backend/src/routes/consignment/offers.js` (idempotency-keyed Stripe checkout session creation) have no corresponding tests in `backend/tests/`. This is the only revenue-adjacent code path in the backend with no safety net.

**Fixed:** Added 24 tests covering webhook signature/secret validation, per-event-type DB writes, unhandled-event/handler-failure paths, offer auth/ownership/duplicate validation, and the checkout-session idempotency guard. Verified against the real docker-compose Postgres+Redis stack (all 295 backend tests pass), not just the mocked DI path.

---

## High priority (address within 1–2 sprints)

### 3. ESLint doesn't gate CI, `backend/railway.toml` conflicts with `railway.json`
**Category:** Infra · **Priority:** 35 each

- `.github/workflows/eslint.yml` had `continue-on-error: true` on the lint step — failures never blocked merges. **Fixed in this pass**: flag removed, the 19 pre-existing lint errors in `frontend/` (missing markdown code-block languages, a single-word component name, unused test imports, `any`/`Function` types in a test mock) were fixed first so the gate doesn't go red immediately.
- `backend/railway.toml` (`buildCommand = "npm ci"`) directly contradicted the active `backend/railway.json` (`pnpm install --frozen-lockfile`) — there's no npm lockfile in `backend/`, so this was dead/stale config. **Fixed in this pass**: `railway.toml` deleted; no other workspace has a `.toml` alongside its `.json`.

---

### 4. Documentation drift: SECURITY.md, CLAUDE.md
**Category:** Docs · **Priority:** 35 / 24

- `SECURITY.md` claimed "52 backend validation vulnerabilities... currently pending fixes," while its own linked evidence (`VALIDATION_BUGS_FOUND.md`) shows those 52 candidate failures were triaged to 7 distinct bugs, all fixed as of 2025-12-12. **Fixed in this pass.**
- `CLAUDE.md` — the primary onboarding/agent-guidance doc — has zero mentions of the `marketplace/` workspace, `stripe-webhooks.js`, `consignment/offers.js`, `blog-posts.js`, `admin/product-variants.js`, the `workers/` directory, or the Anthropic SDK moderation integration, despite these being live feature areas, some money-handling. **Fixed in this pass.**

---

### 5. FTC affiliate disclosure enforced ad-hoc, not via a shared component
**Category:** Architecture/Compliance · **Impact:** 3 · **Risk:** 4 · **Effort:** 2 · **Priority:** 28

Disclosure text is hardcoded independently in the site footer, product detail page, and a `ProductCard` tooltip. No single source of truth means a new page rendering affiliate links has nothing forcing it to include the disclosure — CLAUDE.md states this is a hard legal requirement. Unclear whether `marketplace/` carries equivalent disclosure at all.

**Fixed:** Extracted `frontend/app/components/AffiliateDisclosure.vue` (badge/inline/footer variants), replaced all 3 hardcoded copies, added direct component tests. Verified live in the browser (footer variant) and via the existing/new Vue Test Utils assertions (badge/inline variants — no local Supabase instance was available to render the live product catalog, so those two variants rely on test-level verification, which exercises the exact same markup). **`marketplace/` audited and confirmed out of scope**: it's a peer-to-peer consignment marketplace (Stripe Connect direct sales), not a third-party-affiliate-link catalog, so FTC affiliate disclosure doesn't apply there — it already discloses its actual obligation (15% platform fee) to sellers in `marketplace/app/pages/account/stripe.vue`.

---

### 6. Admin CRUD pages duplicated 3x, with near-zero test coverage
**Category:** Code/Test · **Impact:** 4 · **Risk:** 3 · **Effort:** 3 · **Priority:** 21

`admin-frontend/app/pages/categories.vue`, `reviews.vue`, and `products/index.vue` each hand-roll ~500 lines of nearly identical pagination/edit/delete-modal state, with inconsistent page-size limits. None of the three have direct test coverage beyond one narrowly-scoped regression test on `reviews.vue`. `useSupabaseAdmin.ts` and `useRateLimit.ts` also have zero test coverage.

**Fix:** Extract a shared `useAdminCrudList` composable; add tests for it and for the auth-adjacent composables.

---

### 7. Duplicate schema in migrations 002 and 005
**Category:** Architecture · **Impact:** 2 · **Risk:** 3 · **Effort:** 2 · **Priority:** 20

`supabase/migrations/002_alter_admins_and_credentials.sql` and `005_admin_webauthn.sql` both add the same `admins` columns and both `create table if not exists webauthn_credentials` with the same indexes/RLS policy. Only safe because of `if not exists` guards and numbered execution order.

**Fixed:** Added comments on both files explaining the redundancy is intentional/historical and why neither should be edited to "deduplicate" (both may already be applied to production/team databases — Supabase tracks migrations by filename, so editing history would desync already-migrated environments). No SQL semantics changed; migrations re-applied cleanly in a fresh local Postgres to confirm.

---

## Medium priority

### 8. Backend route inconsistencies
**Priority:** 18 — Two unsynced email-validation regexes (`auth.js` strict vs `webauthn.js` loose), no standard error-response envelope across routes, `admin/products.js` POST/PATCH has no Fastify schema validation (unlike `categories.js`/`reviews.js`/`product-variants.js`), duplicated session-lookup SQL between `adminAuth.js` middleware and `auth.js`'s `GET /session`.

### 9. Cross-workspace dependency & CI drift
**Priority:** 16 — vue-router (`^5` in frontend/marketplace vs `^4` in admin-frontend), pnpm `packageManager` (10.x vs 11.x in backend), TypeScript (`^5` vs `^6`), `mcp-dhgate` still declares `node >=20` vs `>=24` elsewhere. `ci.yml` and `test.yml` are largely duplicate workflows.

### 10. Stale minor docs
**Priority:** 16 — `frontend/FILTERING_SYSTEM.md` describes a client-side rating filter that's now a no-op (filtering moved server-side); `ADMIN_PANEL_SETUP.md`'s file tree is out of date; `TEST_COVERAGE_SUMMARY.md` cites a nonexistent `frontend/tests/cart.test.ts`; `.env.example` is missing `FRONTEND_URL` (required per `RAILWAY.md`/`CLAUDE.md`).

### 11. Drifted duplicate test files
**Priority:** 16 — `frontend/tests/ProductCard.test.ts` and `frontend/tests/components/ProductCard.test.ts` test the same component with different fixtures.

### 12. `mcp-dhgate` has no tests or CI job
**Priority:** 15

### 13. `docker-compose.yml` hardcoded fallback dev credentials
**Priority:** 15 — via `${VAR:-default}`; low risk today but a copy-paste into a prod-like compose file would leak a known password pattern.

---

## Low priority / cleanup

| # | Item | Priority |
|---|------|----------|
| 14 | Pervasive `any` types in `admin-frontend` (~38 occurrences) vs `frontend` (~1) | 12 |
| 15 | Duplicated `useDarkMode.ts` (byte-identical) and Supabase query-building logic across workspaces, no shared package | 12 |
| 16 | `backend-security-reference/` not in workspace/CI — can silently drift from the real security code it models | 12 |
| 17 | `connect-redis` dead dependency in `backend/package.json` (unused — hand-rolled `RedisSessionStore` used instead) | 10 |
| 18 | `ProductCardSimple.vue` confirmed unused outside its own test file | 10 |

---

## Phased remediation plan

### Phase 1 — this sprint (~half day)
- [x] Delete stale `backend/railway.toml`
- [x] Fix 19 pre-existing ESLint errors in `frontend/`, remove `continue-on-error: true` from `eslint.yml`
- [x] Correct `SECURITY.md`'s vulnerability count and status
- [x] Add `marketplace/` lockfile + CI coverage (test/lint config for `marketplace/` itself deliberately left as a follow-up — see #1)
- [x] Update `CLAUDE.md` with missing feature areas

### Phase 2 — next 1–2 sprints, alongside feature work
- [x] Write integration tests for Stripe webhooks + consignment offers (#2)
- [x] Extract shared FTC disclosure component, verify `marketplace/` parity (#5)
- [x] Annotate migrations 002 and 005 (#7)
- [ ] Extract `useAdminCrudList` composable from the three admin CRUD pages (#6) — characterization tests for the pages come first, since they currently have near-zero coverage and refactoring untested code has no safety net
- [ ] Add Fastify schema validation to `admin/products.js`, unify error envelope, dedupe email regex (#8)

### Phase 3 — quality ceiling, opportunistic
- Reduce `any` usage in `admin-frontend` (#14)
- Align cross-workspace dependency versions (#9)
- Add test runner + CI job for `mcp-dhgate` (#12)
- Refresh remaining stale minor docs (#10)
- Merge `ci.yml`/`test.yml`; consolidate drifted `ProductCard` test files (#9, #11)
- Remove `connect-redis`, resolve or remove `ProductCardSimple.vue` (#17, #18)
