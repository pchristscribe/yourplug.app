# Tech Debt Audit — Swordfighters App

**Audit date:** 2026-05-10
**Scope:** Full codebase (admin-frontend, frontend, backend, infra)
**Focus categories:** Dependencies & security · Test coverage · Code quality
**Scoring:** Priority = (Impact + Risk) × (6 − Effort) — higher is worse/more urgent

---

## Critical findings (fix before next deploy)

### 1. Redis cache invalidation is silently broken — backend
**Category:** Code quality
**Impact:** 5 | **Risk:** 5 | **Effort:** 2 | **Priority score:** 40

`redis.del('products:list:*')` appears in `admin/products.js` after every create, update, and delete. Redis `DEL` takes exact keys — it does not accept glob patterns. The wildcard is treated as a literal key name, so the list cache is never actually cleared. Admins can update a product and the public site will serve stale data indefinitely (1-hour TTL for product detail, 5-minute for lists).

**Fix:** Replace with `SCAN` + `DEL`, or switch the cache key strategy to a prefix you can invalidate with `redis.keys()` + `redis.del(...keys)`. Example:

```js
const keys = await redis.keys('products:list:*')
if (keys.length) await redis.del(...keys)
```

---

### 2. Unvalidated body passed directly to Prisma create/update — backend
**Category:** Code quality / security
**Impact:** 5 | **Risk:** 5 | **Effort:** 2 | **Priority score:** 40

In `admin/products.js`, `POST /` does `prisma.product.create({ data: request.body })` and `PATCH /:id` does `prisma.product.update({ data: request.body })`. Any field in the Prisma schema — including `id`, `createdAt`, `updatedAt`, `platform`, `affiliateLinks` relations — can be set or overwritten by an authenticated admin. It also means a future schema field is auto-writable without a deliberate decision to expose it.

This is behind `adminAuth`, so the blast radius is limited to authenticated admins, but the pattern is fragile and will burn you if the auth layer ever has a bug.

**Fix:** Destructure an explicit allowlist from `request.body` before passing to Prisma:1

```js
const { title, description, imageUrl, price, currency, categoryId, platform, externalId, status, rating, tags, metadata } = request.body
await prisma.product.create({ data: { title, description, ... } })
```

Adding Fastify JSON Schema validation to the POST/PATCH bodies would also catch type errors before they reach the ORM.

---

### 3. `useRateLimit` called at module scope — admin-frontend
**Category:** Code quality / SSR safety
**Impact:** 4 | **Risk:** 5 | **Effort:** 1 | **Priority score:** 45

In `admin-frontend/app/stores/auth.ts`, line 6:

```ts
const rateLimit = useRateLimit()
```

This is at the top level of the module, outside any Vue composable or setup context. Nuxt auto-imports composables like `useRateLimit` and they rely on Vue's current instance or the Nuxt app context. Calling them at module scope during SSR can produce cross-request state leakage — the rate limiter state from one user's request bleeds into another's. The error in your project instructions (the Pinia `app:rendered` hook error) is likely related to this exact pattern — composables that hold reactive state being initialized outside the request lifecycle.

**Fix:** Move the `useRateLimit()` call inside each action that uses it, or inside `setup()` / `onMounted`:

```ts
actions: {
  async loginWithSecurityKey(email: unknown) {
    const rateLimit = useRateLimit()  // inside the action
    ...
  }
}
```

---

## High priority (address within 2 sprints)

### 4. Backend excluded from CI test matrix
**Category:** Test coverage
**Impact:** 4 | **Risk:** 4 | **Effort:** 2 | **Priority score:** 32

`ci.yml` runs unit tests for `frontend` and `admin-frontend` only. The `backend` workspace is absent from the matrix. Backend tests exist (`tests/products.test.js`, `tests/webauthn.test.js`, etc.) but never run in CI. A broken Fastify route, Prisma query, or auth middleware change can ship without any automated gate.

The backend tests also require a live Postgres + Redis, which is why they were probably excluded — but that's fixable with a `services:` block in the CI job.

**Fix:** Add a `backend-test` job to `ci.yml` with Postgres 16 and Redis 7 service containers:

```yaml
backend-test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_PASSWORD: test
        POSTGRES_DB: swordfighters_test
    redis:
      image: redis:7
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
    - run: pnpm install --frozen-lockfile
      working-directory: backend
    - run: SUPABASE_ACCESS_TOKEN=${{ secrets.SUPABASE_ACCESS_TOKEN }} SUPABASE_PROJECT_REF=${{ secrets.SUPABASE_PROJECT_REF }} ./scripts/migrate.sh
      working-directory: backend
      env:
        DATABASE_URL: postgresql://postgres:test@localhost/swordfighters_test
    - run: pnpm test
      working-directory: backend
```

---

### 5. CI uses Node 22, engines requires Node ≥24
**Category:** Dependencies
**Impact:** 3 | **Risk:** 4 | **Effort:** 1 | **Priority score:** 21

All three `package.json` files declare `"engines": { "node": ">=24" }`, but `ci.yml` installs Node 22 via `actions/setup-node`. This means CI is testing against an unsupported runtime. If any code relies on a Node 24+ API, CI will silently pass while production (presumably Node 24) could fail — or vice versa.

**Fix:** Change `node-version: '22'` to `node-version: '24'` in `ci.yml` (all jobs). Also update `deploy-frontend.yml` and `deploy-backend.yml` if they pin a version.

---

### 6. `node` listed as a production dependency — backend
**Category:** Dependencies
**Impact:** 4 | **Risk:** 3 | **Effort:** 1 | **Priority score:** 21

`backend/package.json` has `"node": "^25.8.2"` in `dependencies`. Node.js is the runtime — it is not a package you install. This does nothing at best (the registry has a stub `node` package that warns exactly about this), wastes an install step, and can cause confusion if anyone reads the lockfile or a tool tries to resolve it as a peer dep.

**Fix:** Remove it from `dependencies`.

---

### 7. `@prisma/studio-core` pinned to a GitHub source
**Category:** Dependencies
**Impact:** 3 | **Risk:** 4 | **Effort:** 1 | **Priority score:** 21

`"@prisma/studio-core": "github:prisma/studio"` is a production dependency pinned to a GitHub repo with no tag or commit hash. It will resolve to whatever is on that repo's default branch at install time — meaning two installs a week apart can pull different code. It also doesn't go through pnpm's integrity checking.

This is almost certainly a development convenience (Prisma Studio is a dev tool) that leaked into production dependencies.

**Fix:** Move to `devDependencies`, and pin a specific tag or commit: `github:prisma/studio#v0.x.y`.

---

### 8. `prettier-plugin-prisma` in production dependencies — backend
**Category:** Dependencies
**Impact:** 2 | **Risk:** 2 | **Effort:** 1 | **Priority score:** 12

A formatter plugin belongs in `devDependencies`. Currently it inflates the production install.

**Fix:** `pnpm add -D prettier-plugin-prisma` and remove from `dependencies`.

---

### 9. Search is vulnerable to PostgREST filter injection — frontend
**Category:** Code quality / security
**Impact:** 4 | **Risk:** 3 | **Effort:** 2 | **Priority score:** 28

In `useSupabaseProducts.ts`, `searchProducts` builds its filter with string interpolation:

```ts
.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
```

The `query` value comes directly from user input. PostgREST parses this string server-side. A crafted input like `a%,id.eq.some-uuid` could manipulate the filter logic. Supabase's JS client does some encoding, but relying on that is fragile — the safe path is to use the structured filter methods:

```ts
.or(`title.ilike.%${encodeURIComponent(query)}%,description.ilike.%${encodeURIComponent(query)}%`)
```

Or better, move full-text search to a Postgres `to_tsvector`/`to_tsquery` approach using a Supabase RPC.

---

### 10. `cleanupExpiredChallenges` runs as `onRequest` middleware on every request
**Category:** Code quality / architecture
**Impact:** 3 | **Risk:** 3 | **Effort:** 2 | **Priority score:** 24

`app.js` registers `cleanupMiddleware` as an `onRequest` hook. This fires a Postgres `updateMany` on every single HTTP request — including static asset requests, health checks, and high-frequency product list polls. It's fire-and-forget (`catch` swallowed), so failures are invisible. Under load this creates unnecessary DB write pressure.

**Fix:** Move challenge cleanup to a Bull queue job scheduled every 5 minutes. The Bull dependency is already installed and the cleanup logic is already in `cleanupExpiredChallenges.js` — this is a straightforward wiring task.

---

### 11. Console.log with emoji left in production auth code — admin-frontend
**Category:** Code quality
**Impact:** 2 | **Risk:** 3 | **Effort:** 1 | **Priority score:** 15

`auth.ts` has 15+ `console.log` / `console.error` calls with emoji that print sensitive operational details (API base URL, credential objects, auth state) in production browser consoles. Anyone opening DevTools can read auth flow internals.

**Fix:** Replace with structured logging gated on `import.meta.dev`, or remove entirely. The critical error paths already feed `this.error` for UI display.

---

### 12. Client-side rating filter conflicts with server-side pagination
**Category:** Code quality / architecture
**Impact:** 3 | **Risk:** 3 | **Effort:** 3 | **Priority score:** 18

In `products.ts`, the `filteredProducts` getter applies a `minRating` filter in JavaScript on the already-paginated result set from the server. This means: if page 1 has 20 products and 15 fail the rating filter, the user sees 5 products on page 1 — not because there are only 5, but because the server sent 20 and 15 were hidden. The pagination controls will show wrong counts and "next page" behavior will be broken.

`useSupabaseProducts.ts` already supports `minRating` as a server-side query parameter (line 77–79). The client-side filter in the getter is redundant and wrong when used with pagination.

**Fix:** Remove the client-side rating filter from the `filteredProducts` getter. Ensure `filters.minRating` is always passed through to `getProducts()`, which already sends it to Supabase.

---

### 13. ESLint packages in production `dependencies` — frontend
**Category:** Dependencies
**Impact:** 2 | **Risk:** 2 | **Effort:** 1 | **Priority score:** 12

`frontend/package.json` has `@eslint/css`, `@eslint/js`, `@eslint/json`, `@eslint/markdown`, `eslint`, `eslint-plugin-vue`, `typescript-eslint`, and `globals` in `dependencies` rather than `devDependencies`. These increase production bundle install time and are never used at runtime.

**Fix:** Move all `@eslint/*`, `eslint`, `typescript-eslint`, and `globals` to `devDependencies`.

---

### 14. No automated dependency update mechanism
**Category:** Dependencies
**Impact:** 3 | **Risk:** 3 | **Effort:** 2 | **Priority score:** 24

There is no Dependabot or Renovate configuration. Security patches to `fastify`, `@simplewebauthn/*`, `@sentry/*`, and Supabase client won't surface automatically. The `pnpm audit` step in CI is a safety net, but it won't propose upgrades — only flag known CVEs.

**Fix:** Add `.github/dependabot.yml` with weekly pnpm updates across all three workspaces. Configure automerge for patch-level bumps.

---

### 15. `@prisma/client-runtime-utils` and `@prisma/prisma-schema-wasm` as direct user deps
**Category:** Dependencies
**Impact:** 2 | **Risk:** 3 | **Effort:** 1 | **Priority score:** 15

These are internal Prisma packages meant to be managed by the Prisma CLI, not listed as direct user dependencies. The `@prisma/prisma-schema-wasm` version even includes a hardcoded git commit hash (`7.8.0-6.3c6e...`). Direct pins like this break when Prisma releases updates and can create version mismatches between the user-declared version and what `prisma generate` expects.

**Fix:** Remove both from `dependencies`. Let the Prisma CLI manage them as peer/transitive deps. Keep only `@prisma/client` and `prisma` (dev).

---

### 16. No coverage enforcement in CI
**Category:** Test coverage
**Impact:** 3 | **Risk:** 3 | **Effort:** 2 | **Priority score:** 24

The `test:coverage` script exists in all workspaces but CI runs `pnpm test` (not `pnpm test:coverage`), so no thresholds are enforced. Coverage can drop to 0% without a CI failure. CLAUDE.md claims ">80% coverage required" for new features, but nothing enforces this.

**Fix:** Add a coverage step to the CI test jobs, and set thresholds in `vitest.config.ts`:

```ts
coverage: {
  provider: 'v8',
  thresholds: { lines: 80, functions: 80, branches: 70 }
}
```

---

### 17. E2E tests silently skipped in CI
**Category:** Test coverage
**Impact:** 3 | **Risk:** 3 | **Effort:** 2 | **Priority score:** 24

The E2E job in `ci.yml` has `if: ${{ secrets.NUXT_PUBLIC_SUPABASE_URL != '' }}`. The condition syntax is wrong — GitHub expressions don't evaluate secrets this way; the expression will always be falsy in a fork or a repo that hasn't configured the secret. The E2E tests never run in CI.

**Fix:** Use `if: ${{ secrets.NUXT_PUBLIC_SUPABASE_URL != '' && env.NUXT_PUBLIC_SUPABASE_URL != '' }}` or restructure to use environment-based secrets and document that E2E requires environment setup.

---

## Phased remediation plan

### Phase 1 — Two days, ship-blocking bugs
These are defects masquerading as tech debt. Do them before any other feature work.

| # | Item | Est. |
|---|------|------|
| 3 | Move `useRateLimit()` into action scope (fix the SSR crash) | 30 min |
| 1 | Fix Redis wildcard `DEL` → `SCAN + DEL` | 1 hour |
| 2 | Add explicit field allowlist to `prisma.product.create/update` | 1 hour |

---

### Phase 2 — One sprint, CI & deps hygiene
Do alongside normal feature work. Each item is ≤1 hour and unblocks better confidence in the pipeline.

| # | Item | Est. |
|---|------|------|
| 5 | Fix CI Node version (22 → 24) | 10 min |
| 6 | Remove `node` from production deps | 5 min |
| 8 | Move `prettier-plugin-prisma` to devDeps | 5 min |
| 13 | Move ESLint packages to devDeps in frontend | 10 min |
| 15 | Remove internal Prisma packages from user deps | 15 min |
| 7 | Pin `@prisma/studio-core` to tag and move to devDeps | 15 min |
| 11 | Strip production `console.log` from `auth.ts` | 30 min |
| 4 | Add backend to CI test matrix with service containers | 2 hours |
| 17 | Fix the E2E CI condition so it actually runs | 30 min |
| 14 | Add `.github/dependabot.yml` for weekly pnpm updates | 20 min |

---

### Phase 3 — Two sprints, quality ceiling
These improve robustness but require more careful thought.

| # | Item | Est. |
|---|------|------|
| 12 | Remove client-side rating filter from getter; ensure server-side filter fires | 2 hours |
| 9 | Replace search string interpolation with encoded params or Postgres FTS RPC | 3 hours |
| 10 | Move challenge cleanup to Bull scheduled job (every 5 min) | 2 hours |
| 16 | Add vitest coverage thresholds and run `test:coverage` in CI | 1 hour |
| — | Write backend integration tests for admin create/update/delete with invalid bodies | 4 hours |

---

## Summary table

| # | Finding | Category | Priority |
|---|---------|----------|---------|
| 3 | `useRateLimit` at module scope → SSR crash | Code | **45** |
| 1 | Redis wildcard DEL is no-op → stale cache forever | Code | **40** |
| 2 | Unvalidated body passed to Prisma → field injection | Code/Security | **40** |
| 4 | Backend excluded from CI test matrix | Tests | **32** |
| 9 | Search filter interpolation → PostgREST injection | Code/Security | **28** |
| 5 | CI uses Node 22, engines requires 24 | Deps | **21** |
| 6 | `node` as production dependency | Deps | **21** |
| 7 | Prisma Studio pinned to unpinned GitHub source | Deps | **21** |
| 10 | Cleanup middleware fires on every request | Code | **24** |
| 14 | No Dependabot/Renovate | Deps | **24** |
| 16 | No coverage thresholds enforced | Tests | **24** |
| 17 | E2E CI condition always false | Tests | **24** |
| 12 | Client-side rating filter breaks paginated results | Code | **18** |
| 11 | Production console.logs leak auth internals | Code | **15** |
| 15 | Internal Prisma packages as direct user deps | Deps | **15** |
| 8 | Prettier-prisma in prod deps | Deps | **12** |
| 13 | ESLint in prod deps (frontend) | Deps | **12** |
