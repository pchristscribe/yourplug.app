# AGENTS.md

This file provides guidance to Codex when working with code in this repository. It mirrors `CLAUDE.md` — keep the two in sync when structure changes.

## Project Overview

yourplug App is an affiliate marketing + peer-to-peer consignment platform targeting gay men. It curates products from DHgate, AliExpress, Amazon, and Wish, and (via "Plug Market") lets users list and sell their own secondhand items through a Stripe Connect marketplace.

- Product reviews, seasonal recommendations, blog posts
- Targeted drop shipping on DHgate for group orders
- Plug Market: peer-to-peer consignment listings, offers, seller Stripe onboarding, admin moderation
- FTC-compliant disclosure of affiliate relationships and monetary considerations

## Repository Structure

This is a pnpm monorepo (`pnpm-workspace.yaml`) with five workspace packages plus Supabase/infra glue:

```
yourplug-fullstack/
├── frontend/                   # User-facing product catalog (Nuxt 4, port 3000)
├── admin-frontend/             # Admin panel, WebAuthn auth (Nuxt 4, port 3002)
├── marketplace/                # "Plug Market" consignment app (Nuxt 4, port 3003)
├── backend/                    # Fastify API + background worker (port 3001) — deployable via Railway
├── mcp-dhgate/                 # DHgate MCP server for product scraping
├── backend-security-reference/ # Read-only security reference — do not edit
├── supabase/
│   ├── migrations/             # SQL migrations, source of truth for DB schema
│   ├── functions/              # Edge functions (e.g. track-click)
│   └── config.toml
├── scripts/                    # migrate.sh, backup-db.sh
├── setup                       # One-shot dev bootstrap script (see below)
├── docker-compose.yml          # PostgreSQL 16 + Redis 7
└── .mcp.json                   # MCP servers: DeepGraph Vue MCP, Supabase
```

`backend-security-reference/` is reference material only — never modify it; backend feature work happens in `backend/`.

Note: `marketplace/` is the newest workspace. It's in `ci.yml`'s security-audit, unit-test, and build matrices, but has **no Playwright e2e job and no lint gate** (`eslint.yml` is frontend-only), so run its e2e/lint manually when touching that workspace.

## Commands

### Bootstrap

```bash
./setup                       # install all workspaces, create .env, start Docker infra
./setup --no-docker           # skip starting Postgres/Redis
./setup --workspace backend   # set up a single workspace
./setup --check               # verify prerequisites only, change nothing
```

### Per-workspace dev/build/test (run inside `frontend/`, `admin-frontend/`, `marketplace/`, or `backend/`)

```bash
pnpm install
pnpm dev                # backend: Fastify with --watch; others: nuxt dev
pnpm build               # frontends only: nuxt build
pnpm test                # vitest run (all unit tests)
pnpm test:watch          # vitest watch mode
pnpm test:ui             # vitest UI
pnpm test:coverage       # vitest run --coverage
```

Run a single test file or test name with vitest directly, e.g.:

```bash
pnpm vitest run tests/filters.test.ts
pnpm vitest run -t "some test name"
```

Frontend and admin-frontend also have Playwright e2e (`marketplace` does not):

```bash
pnpm test:e2e
pnpm test:e2e:ui
```

There is no `pnpm lint` script in any workspace. Lint by invoking ESLint directly (flat config, `eslint.config.ts`), e.g. as CI does:

```bash
pnpm exec eslint .
```

Backend has an additional long-running worker process (Bull/Redis job queue — see Background Jobs below):

```bash
cd backend && pnpm worker
```

### Database

```bash
docker exec -it yourplug-postgres psql -U yourplug -d yourplug_db
docker exec -it yourplug-redis redis-cli -a dev_redis_password

# Apply Supabase migrations to the hosted project (backend has no migration runner of its own)
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... ./scripts/migrate.sh

./scripts/backup-db.sh   # local Postgres backup, retains 30 days by default
```

### Docker infra

```bash
docker-compose up -d / down / logs -f [svc] / restart
docker-compose down -v   # ⚠️ deletes all data
```

## Architecture

### Backend (`backend/`)

Fastify 5 on Node 24+. `fastify.sql` is a `postgres-js` client (`src/lib/sql.js`) configured with `transform: postgres.camel`, so all query results come back camelCase even though the DB columns are snake_case — write raw `sql\`...\`` template queries directly in route handlers, there is no ORM. Schema source of truth is `supabase/migrations/`; the backend has no migration runner itself (`scripts/migrate.sh` applies them to Supabase).

Route groups:
- `src/routes/products.js`, `categories.js`, `blog-posts.js` — public catalog/content API
- `src/routes/admin/*` — auth (session + WebAuthn), categories, products, reviews, blog-posts, product-variants, consignment moderation — all gated by `src/middleware/adminAuth.js`
- `src/routes/consignment/{listings,offers,seller}.js` — public/authenticated Plug Market API (listings browse, offers, seller onboarding/dashboard)
- `src/routes/stripe-webhooks.js` — Stripe Connect webhook handler

Sessions are Redis-backed (`@fastify/session` + `connect-redis`, `src/lib/sessionStore.js`). WebAuthn (admin-only) uses `@simplewebauthn/server`. Monitoring is Sentry (`@sentry/node`, `@sentry/profiling-node`, init in `src/instrument.js` — loaded via `--import` in both `dev`/`start`/`worker` scripts, not a normal import).

**Background jobs**: `src/workers/index.js` is a *separate process* (`pnpm worker`) built on `bull`, connected to the same Redis instance. It currently schedules a recurring `cleanup-expired-challenges` job (removes expired WebAuthn challenges). Running `pnpm dev`/`pnpm start` does **not** start the worker — it must be run separately in production (see `RAILWAY.md`).

**Plug Market / consignment marketplace**: sellers onboard via Stripe Connect Express accounts (`src/lib/stripe.js`, `seller_profiles.stripe_account_id`). Listings go through a moderation pipeline (`listing_status`: `DRAFT` → `PENDING_MODERATION` → `APPROVED`/`REJECTED` → `SOLD`/`ARCHIVED`; separate `moderation_decision` enum) — see `supabase/migrations/012_consignment_marketplace.sql` for the full schema (listings, offers, payment status). Listing images go through `src/lib/imageStorage.js` / `imageFreshness.js` / `moderation.js`.

### Frontends (`frontend/`, `admin-frontend/`, `marketplace/`)

All three are Nuxt 4 (Vue 3 + SSR) with Pinia, `@nuxtjs/tailwindcss`, `@nuxtjs/supabase`, and Sentry (`@sentry/nuxt`), sharing one Tailwind design system (see Design System below). Composables live in `app/composables/` and stores in `app/stores/`, both auto-imported by Nuxt.

| Workspace | Port | HMR port | Auth model |
|---|---|---|---|
| `frontend` | 3000 | 24677 | Supabase OAuth (Google/GitHub/Discord) |
| `admin-frontend` | 3002 | 24678 | WebAuthn primary, password fallback |
| `marketplace` | 3003 | 24676 | Supabase OAuth session; route guard in `app/middleware/auth.ts` redirects to `/login` if no session |

`marketplace` calls the backend's `consignment` API using bearer tokens: `useAuthHeaders()` pulls the Supabase session's `access_token` and returns an `Authorization: Bearer ...` header, consumed by `useListings`, `useOffers`, `useSeller`, `useSellerAccount`.

`admin-frontend` auth: WebAuthn via `@simplewebauthn/browser` (client) / `@simplewebauthn/server` (backend), with a password fallback (`POST /api/admin/auth/login`, bcrypt) for devices without WebAuthn. Auth store (`app/stores/auth.ts`) exposes `loginWithSecurityKey()`, `loginWithPassword()`, `checkSession()`, `logout()`. `useCsrf` attaches a CSRF token to every mutating request (rotated on login). `useRateLimit` client-side throttles login attempts (5/min, 5-min lockout, shared bucket across both login modes). CSP headers are set in `nuxt.config.ts`.

`frontend` filter store (`app/stores/filters.ts`) maps to URL query params via `toQueryParams()`/`initFromQuery()` for shareable filtered links (category, platform, price 0–500, rating, sort — default `createdAt desc`).

### DHgate MCP Server (`mcp-dhgate/`)

Standalone MCP server (TypeScript) for scraping DHgate product data — `src/index.ts`, `tools/`, `api/`, `types.ts`. Wired into `.mcp.json` alongside the DeepGraph Vue MCP and Supabase MCP servers used by this tool.

### Supabase (`supabase/`)

Migrations run in numeric order and are the schema source of truth (currently 001–013, spanning core schema, admin WebAuthn, reviews, user profiles, product variants, blog posts, security fixes, and the consignment marketplace). `functions/track-click/` is an Edge Function recording affiliate-link clicks into the clicks ledger.

## CI

- `ci.yml` — security audit, unit tests, and build verification, each a matrix across `frontend`/`admin-frontend`/`marketplace`/`mcp-dhgate`; a separate `backend-test` job (spins up real Postgres 16 + Redis 7 service containers, applies all `supabase/migrations/*.sql` plus stubbed `auth`/`storage` schemas, then runs backend vitest); and e2e (Playwright, `frontend`/`admin-frontend` only, gated behind repo var `E2E_ENABLED`). This absorbed the old `test.yml`, which no longer exists.
- `eslint.yml` — SARIF lint scan, currently `frontend` only.
- `nightly-e2e.yml` — unconditional nightly Playwright run for `frontend`/`admin-frontend`.
- `deploy-backend.yml`, `claude.yml`, `claude-code-review.yml`, `dependabot-auto-merge.yml`.

`marketplace` is covered by `ci.yml`'s security-audit, unit-test, and build-verification matrices, but has no Playwright e2e job and isn't included in the `eslint.yml` SARIF scan (frontend-only).

## Design System

Shared Tailwind config across all three frontends:
- Colors: `brand` (#8B1E2D, deep red), `accent` (#D6A77A, skin tone), `surface`/`ink` light-dark variants, `status` (error/warning/success/info)
- Fonts: **Excon** for headers (`h1`–`h6`, `font-heading`), **General Sans** for body (`font-sans`) — both via [Fontshare](https://www.fontshare.com/)
- Dark mode: `class` strategy, `dark:` prefix, managed by `useDarkMode` composable + `DarkModeToggle.vue`
- Headless UI components prefixed `Headless` (via `nuxt-headlessui`) in `frontend`

## Environment Variables

See `.env.example` for the full list. Notable ones beyond the obvious Supabase/DB/Redis vars:

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_API_BASE` | Backend API base exposed to the browser (`useRuntimeConfig().public.apiBase`) |
| `API_BASE_URL` | Backend API base for server-side use only (default `http://localhost:3001`) |
| `SESSION_SECRET` | Backend session secret, 32+ chars, required in production |
| `RP_ID` | WebAuthn relying party ID (e.g. `admin.yourdomain.com`) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_CONNECT_CLIENT_ID` | Plug Market Stripe Connect config |
| `MARKETPLACE_URL` | Marketplace frontend base URL (default `http://localhost:3003`) |
| `DHGATE_API_KEY` / `ALIEXPRESS_API_KEY` / `AMAZON_ASSOCIATES_TAG` / `WISH_API_KEY` | Affiliate program credentials |
| `DUB_API_KEY` / `DUB_WORKSPACE_ID` | Dub.co affiliate link tracking |
| `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` | Required by `scripts/migrate.sh` |

## Code Style

- No semicolons, single quotes, no unnecessary curly braces, 2-space indentation
- Import order: external → internal → types
- Use `defineNuxtConfig` (not raw Nuxt options); access env vars via `useRuntimeConfig()`
- Never run browser-only code at module level — SSR will fail; guard with `process.client` or `onMounted` (a `useRateLimit`-at-module-scope regression caused exactly this — see the audit-history note at the top of `TECH_DEBT.md`)
- CSRF tokens required for state-mutating admin-frontend requests
- FTC disclosure required on all affiliate links and sponsored/marketplace content

## Documentation Files

| File | Description |
|------|-------------|
| `README.md` | Project overview / quick start |
| `CLAUDE.md` | Equivalent guidance file for Claude Code — keep in sync with this file when structure changes |
| `ADMIN_PANEL_SETUP.md` | WebAuthn setup and admin panel guide |
| `RAILWAY.md` | Railway deployment for backend (incl. worker), frontend, admin-frontend |
| `TECH_DEBT.md` | Prioritized tech-debt audit — check before touching flagged areas (e.g. cache invalidation, request-body validation) |
| `TEST_COVERAGE_SUMMARY.md` | Test metrics and results |
| `VALIDATION_BUGS_FOUND.md` | Documented security/validation bugs |
| `SECURITY.md` / `SECURITY_GUIDE.md` | Security overview and detailed guide |
| `TOUCHID_DEBUG.md` | Touch ID debugging reference |
| `frontend/FILTERING_SYSTEM.md` | Product filter architecture |

## Legal Compliance

All affiliate links and sponsored/marketplace content must include FTC-compliant disclosures stating that the site receives monetary compensation.
