# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

yourplug App is an affiliate marketing platform targeting gay men, curating products from DHgate, AliExpress, Amazon, and Wish. Features include:
- Product reviews and seasonal recommendations
- Targeted drop shipping on DHgate for group orders
- FTC-compliant disclosure of affiliate relationships and monetary considerations

## Repository Structure

```
yourplug-fullstack/
├── admin-frontend/            # Admin panel with WebAuthn authentication (Port 3002)
├── frontend/                  # User-facing product catalog (Port 3000)
├── backend/                   # Fastify API (postgres-js → Supabase + Redis + WebAuthn) — deployable via Railway
├── backend-security-reference/ # Security reference implementation (middleware, routes, utils)
├── mcp-dhgate/                # DHgate MCP server for product scraping
├── supabase/
│   ├── migrations/            # Supabase DB migrations (001 schema, 002 clicks ledger, 003 reviews, 004 admin WebAuthn)
│   ├── functions/             # Edge functions (e.g. track-click)
│   └── config.toml
├── scripts/                   # Helper scripts (migrate.sh, backup-db.sh)
├── keys/                      # Key storage (see README inside)
├── .github/workflows/         # CI/CD: ci.yml, Codex.yml, Codex-review.yml, eslint.yml
├── docker-compose.yml         # PostgreSQL 16 + Redis 7 infrastructure
├── package.json               # Root meta-package (Bun + Supabase CLI tooling glue)
├── .env.example               # Environment variable template
└── .mcp.json                  # MCP server config (DeepGraph Vue MCP)
```

**Backend status**: The Fastify backend lives in this repo and has its own `railway.json`. Historically it was deployed externally; either path is supported (see `RAILWAY.md`). When developing backend features, work inside `backend/` — do not touch `backend-security-reference/`, which is read-only reference material.

## Tech Stack

### Admin Frontend (`admin-frontend/`)
- **Framework**: Nuxt 4 (Vue 3 + SSR), `compatibilityDate: '2025-11-29'`
- **Port**: 3002 (HMR: 24678)
- **Modules**: `@pinia/nuxt`, `@nuxtjs/tailwindcss`, `@nuxtjs/supabase`
- **Auth**: WebAuthn via `@simplewebauthn/browser@^13.2.2` (primary: security keys/Touch ID; fallback: email + password)
- **Monitoring**: Sentry (`@sentry/nuxt`)
- **Testing**: Vitest + Vue Test Utils + happy-dom
- **Security**: CSRF protection, CSP headers configured in `nuxt.config.ts`

### User Frontend (`frontend/`)
- **Framework**: Nuxt 4 (Vue 3 + SSR), `compatibilityDate: '2025-07-15'`
- **Port**: 3000 (HMR: 24677)
- **Modules**: `@nuxtjs/tailwindcss`, `@pinia/nuxt`, `nuxt-headlessui` (prefix: `Headless`), `@nuxtjs/supabase`
- **Auth**: Supabase social OAuth (Google, GitHub, Discord) via `@supabase/supabase-js`
- **Monitoring**: Sentry (`@sentry/nuxt`)
- **Testing**: Vitest + Vue Test Utils + happy-dom; Playwright for e2e (`test:e2e`)
- **Linting**: ESLint with typescript-eslint, eslint-plugin-vue

### Backend API (`backend/`)
- Runtime: Node.js 24+, Framework: Fastify 5
- Database: PostgreSQL via [`postgres-js`](https://github.com/porsager/postgres) — direct queries against Supabase Postgres. Schema source of truth lives in `supabase/migrations/`. The Fastify instance is decorated with a `sql` client (`fastify.sql`) configured with `transform: postgres.camel` so DB columns are returned as camelCase
- Sessions: `@fastify/session` + `connect-redis` (Redis-backed)
- Task Queue: Bull (Redis-backed)
- WebAuthn: `@simplewebauthn/server` (admin auth)
- Monitoring: Sentry (`@sentry/node`, `@sentry/profiling-node`)
- Routes: `src/routes/products.js`, `src/routes/categories.js`, and five admin routes: `src/routes/admin/auth.js`, `categories.js`, `products.js`, `reviews.js`, `webauthn.js`
- Health check: `GET /health` (verifies Postgres + Redis)

### Infrastructure
- Docker Compose: PostgreSQL 16 (`yourplug-postgres`) + Redis 7 (`yourplug-redis`)
- Production: Railway (all three services — see `RAILWAY.md`), Supabase (managed Postgres + Auth + Edge Functions), Sentry (monitoring).
- CI/CD: GitHub Actions (`ci.yml`, `Codex.yml`, `Codex-review.yml`, `eslint.yml`)

## Directory Deep-Dive

### Admin Frontend (`admin-frontend/`)

```
admin-frontend/
├── app/
│   ├── components/
│   │   └── DarkModeToggle.vue
│   ├── composables/
│   │   ├── useCsrf.ts           # CSRF token management
│   │   ├── useDarkMode.ts       # Dark/light mode toggle
│   │   ├── useRateLimit.ts      # Client-side rate limiter (5/min, 5-min lockout)
│   │   └── useSupabaseAdmin.ts  # Supabase admin utilities
│   ├── layouts/
│   │   └── default.vue
│   ├── middleware/
│   │   └── auth.ts              # Route guard for authenticated pages
│   ├── pages/
│   │   ├── index.vue            # Dashboard
│   │   ├── login.vue            # WebAuthn / password login
│   │   ├── products/index.vue   # Product management
│   │   ├── categories.vue       # Category management
│   │   ├── reviews.vue          # Review moderation
│   │   ├── diagnostic.vue       # Diagnostic tools
│   │   └── test-webauthn.vue    # WebAuthn testing page
│   ├── stores/
│   │   └── auth.ts              # Pinia auth store
│   ├── types/
│   │   ├── database.types.ts    # Supabase-generated DB types
│   │   └── supabase.ts          # Supabase client types
│   └── utils/
│       └── security.ts          # Security helpers
├── tests/
│   ├── auth.test.ts             # WebAuthn + password auth tests (174+ total)
│   ├── darkMode.test.ts
│   └── security.test.ts
├── nuxt.config.ts
├── tailwind.config.js
├── vitest.config.ts
├── playwright.config.ts         # E2E config
├── sentry.client.config.ts
├── sentry.server.config.ts
└── railway.json                 # Railway deploy config
```

### User Frontend (`frontend/`)

```
frontend/
├── app/
│   ├── components/
│   │   ├── ProductCard.vue
│   │   ├── ProductCardSimple.vue
│   │   ├── ProductGrid.vue
│   │   ├── SearchBar.vue
│   │   ├── Pagination.vue
│   │   ├── DarkModeToggle.vue
│   │   ├── SocialAuth.vue            # Supabase OAuth buttons (Google, GitHub, Discord)
│   │   ├── feedback/
│   │   │   ├── AppToast.vue
│   │   │   ├── AppToastContainer.vue
│   │   │   ├── AppModal.vue
│   │   │   └── AppAlert.vue
│   │   └── filters/
│   │       ├── ProductFilters.vue    # Main filter container
│   │       ├── CategoryFilter.vue
│   │       ├── PriceRangeFilter.vue
│   │       ├── RatingFilter.vue
│   │       └── SortingControls.vue
│   ├── composables/
│   │   ├── useDarkMode.ts
│   │   ├── useAuth.ts                # Supabase OAuth sign-in / sign-out
│   │   ├── useToast.ts               # Toast notification system
│   │   └── useSupabaseProducts.ts    # Supabase product fetching
│   ├── layouts/
│   │   └── default.vue
│   ├── pages/
│   │   ├── index.vue                 # Product catalog home
│   │   ├── login.vue                 # OAuth sign-in
│   │   ├── confirm.vue               # OAuth redirect handler
│   │   ├── products/[id].vue         # Product detail (dynamic route)
│   │   ├── seasonal/[season].vue     # Seasonal product page
│   │   └── search-demo.vue           # Search demonstration
│   ├── stores/
│   │   ├── filters.ts   # Filter state (category, platform, price, rating, sort)
│   │   └── products.ts  # Product catalog
│   ├── types/
│   │   ├── index.ts
│   │   ├── filters.ts
│   │   ├── database.types.ts
│   │   └── supabase.ts
│   └── utils/
│       └── seasons.ts                # Season name + date helpers
├── tests/
│   ├── ProductCard.test.ts
│   ├── ProductCardSimple.test.ts
│   ├── SearchBar.test.ts
│   ├── darkMode.test.ts
│   ├── filters.test.ts
│   ├── stores.test.ts
│   ├── types.test.ts
│   ├── useToast.test.ts
│   └── components/
├── nuxt.config.ts
├── tailwind.config.js
├── vitest.config.ts
├── playwright.config.ts             # E2E config
├── eslint.config.ts
├── tsconfig.json
└── railway.json                     # Railway deploy config
```

### Backend API (`backend/`)

```
backend/
├── src/
│   ├── index.js               # Server entry (Fastify, binds 0.0.0.0:$PORT)
│   ├── app.js                 # Plugin/route registration
│   ├── lib/
│   │   ├── __tests__/         # Unit tests for lib modules (e.g. sentry.test.js)
│   │   ├── sql.js             # postgres-js client singleton (camel transform)
│   │   ├── redis.js           # ioredis client
│   │   ├── sessionStore.js    # connect-redis store
│   │   └── sentry.js
│   ├── middleware/adminAuth.js
│   ├── routes/
│   │   ├── products.js
│   │   ├── categories.js
│   │   └── admin/
│   │       ├── auth.js
│   │       ├── categories.js
│   │       ├── products.js
│   │       ├── reviews.js
│   │       └── webauthn.js
│   ├── schemas/
│   │   ├── review.js          # Fastify JSON schema
│   │   └── category.js        # Fastify JSON schema
│   └── utils/cleanupExpiredChallenges.js
├── tests/                     # Vitest unit tests
├── package.json
├── railway.json
└── vitest.config.js
```

### DHgate MCP Server (`mcp-dhgate/`)

MCP server for scraping DHgate product data. Has its own `src/` with `index.ts`, `tools/`, `types.ts`, `utils/`, `api/`, and `config.ts`. Configured in `.mcp.json` via `DeepGraph Vue MCP` alongside this tool.

### Supabase (`supabase/`)

- `config.toml` — local Supabase CLI config
- `migrations/` — SQL migrations (`001_initial_schema.sql`, `002_clicks_ledger.sql`, `003_reviews.sql`, `004_admin_webauthn.sql`)
- `functions/track-click/` — Edge Function that records affiliate-link clicks into the clicks ledger

## Development Setup

### Initial Setup
1. Copy `.env.example` to `.env` and fill in values
2. Start infrastructure:
   ```bash
   docker-compose up -d
   docker-compose ps   # verify healthy
   ```

### Frontend Development

```bash
# Admin Panel (http://localhost:3002)
cd admin-frontend && pnpm install && pnpm dev

# User Frontend (http://localhost:3000)
cd frontend && pnpm install && pnpm dev
```

Both frontends can run concurrently — they use separate HMR ports (24678 and 24677).

### Backend Development

```bash
cd backend
pnpm install
pnpm dev                    # Start Fastify with --watch (default :3001)
```

`DATABASE_URL` should point at Supabase Postgres (production: pooler URL with `?sslmode=require`; local dev: docker-compose Postgres). Schema migrations live in `supabase/migrations/` and are applied via `scripts/migrate.sh` — the backend has no migration runner of its own.

### Running Tests

```bash
# Admin Frontend / User Frontend / Backend
cd <workspace>
pnpm test              # Run all unit tests (Vitest)
pnpm test:watch        # Watch mode
pnpm test:ui           # Vitest UI
pnpm test:coverage     # Coverage report

# Frontends only — Playwright E2E
pnpm test:e2e
pnpm test:e2e:ui
```

### Database Management
```bash
# PostgreSQL (local Docker)
docker exec -it yourplug-postgres psql -U yourplug -d yourplug_db

# Redis CLI
docker exec -it yourplug-redis redis-cli -a dev_redis_password

# Apply Supabase migrations to the hosted project
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... ./scripts/migrate.sh

# Local Postgres backup (retains 30 days by default)
./scripts/backup-db.sh
```

### Common Docker Commands
```bash
docker-compose up -d          # Start services
docker-compose down           # Stop services
docker-compose logs -f [svc]  # View logs
docker-compose restart        # Restart services
docker-compose down -v        # Remove volumes (⚠️ deletes all data)
```

## Testing & Quality Assurance

### Test Infrastructure
- **Framework**: Vitest
- **DOM**: happy-dom
- **Component testing**: @vue/test-utils
- **Coverage**: v8 provider, reports: text/json/html
- **Path aliases**: `~/`, `@/` (admin also has `#app`)

### Test Coverage Stats
- **174+ Tests**: WebAuthn + password auth, input validation, frontend stores, components
- **52 Security Bugs Identified**: Documented in `VALIDATION_BUGS_FOUND.md`
- **95% Critical Path Coverage**: All major authentication flows

### Key Test Files
| File | Description |
|------|-------------|
| `admin-frontend/tests/auth.test.ts` | WebAuthn + password auth validation (174+ tests) |
| `admin-frontend/tests/security.test.ts` | Input sanitization, XSS, CSRF |
| `frontend/tests/filters.test.ts` | Filter store and UI |
| `frontend/tests/SearchBar.test.ts` | Search component (17.9 KB) |
| `frontend/tests/ProductCard.test.ts` | Product card component |
| `frontend/tests/useToast.test.ts` | Toast composable |
| `frontend/tests/stores.test.ts` | General store tests |
| `frontend/tests/types.test.ts` | Type safety validation |

### Testing Requirements for New Features
- Vitest tests with >80% coverage
- Input validation tests for all user inputs
- Error handling tests for API calls
- SSR safety checks (no browser-only code running server-side)

## Design System

Both frontends share an identical Tailwind config with:

### Colors
- `brand`: Deep red (`#8B1E2D`) — primary brand color
- `accent`: Skin tone (`#D6A77A`) — secondary accent
- `surface`: Light/dark background variants
- `ink`: Text color variants
- `status`: `error`, `warning`, `success`, `info`

### Typography
- Font: **Dosis** (variable weight 200–800, loaded via Google Fonts)

### Dark Mode
- Implemented via `class` strategy (`dark:` prefix in Tailwind)
- Managed by `useDarkMode` composable in both frontends
- Toggle component: `DarkModeToggle.vue`

### UI Components (User Frontend)
- Headless UI components prefixed with `Headless` (e.g., `<HeadlessDialog>`)
- Feedback components: `AppToast`, `AppModal`, `AppAlert`, `AppToastContainer`

## State Management (Pinia)

### Admin Frontend Stores
| Store | File | Purpose |
|-------|------|---------|
| `auth` | `stores/auth.ts` | WebAuthn session, user state |

### User Frontend Stores
| Store | File | Purpose |
|-------|------|---------|
| `filters` | `stores/filters.ts` | Category, platform, price range, rating, sort |
| `products` | `stores/products.ts` | Product catalog data |

**Filter store** maps to URL query params via `toQueryParams()` and `initFromQuery()`. Price range: 0–500. Sort: `createdAt` (default), `desc` (default order).

## Authentication

### Admin Frontend — WebAuthn + Password fallback

Primary login is WebAuthn (security keys, Touch ID, Windows Hello) via `@simplewebauthn/browser` (client) and `@simplewebauthn/server` (backend). A password toggle on the login page falls back to `POST /api/admin/auth/login` (bcrypt) for devices that can't use WebAuthn.

- Login page: `/login` — defaults to WebAuthn; "Use password instead" toggle reveals password input
- Auth middleware: `app/middleware/auth.ts` — guards all protected routes
- Auth store: `app/stores/auth.ts` — `loginWithSecurityKey()`, `loginWithPassword()`, `checkSession()`, `logout()`
- CSRF protection: `useCsrf` composable (token on every mutating request, rotated on login)
- Client rate limiting: `useRateLimit` (5 attempts / minute, 5-minute lockout; shared bucket for both login modes)
- Supabase backed: `useSupabaseAdmin` composable
- Backend routes: `backend/src/routes/admin/webauthn.js` (WebAuthn), `backend/src/routes/admin/auth.js` (password + session)
- CSP headers configured in `nuxt.config.ts` to prevent XSS

### User Frontend — Supabase OAuth

Supabase social login via `@supabase/supabase-js`:
- Providers: Google, GitHub, Discord (configurable in Supabase dashboard)
- Composable: `useAuth` (`signInWithOAuth`, `signOut`, reactive `user`)
- Component: `SocialAuth.vue`
- Pages: `/login` initiates OAuth, `/confirm` handles the redirect

## Environment Variables

Key variables (see `.env.example` for full list):

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NUXT_PUBLIC_SUPABASE_KEY` | Supabase anon key |
| `NUXT_SUPABASE_SERVICE_KEY` | Supabase service role key (admin only — never expose client) |
| `NUXT_PUBLIC_SITE_URL` | Public site URL (canonical links, OG, sitemap) |
| `NUXT_PUBLIC_API_BASE` | Backend API base — set this in both frontends; exposed via Nuxt runtime config (`useRuntimeConfig().public.apiBase`) |
| `API_BASE_URL` | Backend API base for server-side / backend-internal use (default: `http://localhost:3001`); not visible to the browser |
| `DATABASE_URL` | PostgreSQL connection string for the backend (`postgres-js`). Use the Supabase pooler URL (`?sslmode=require`) in production |
| `REDIS_URL` / `REDIS_PASSWORD` | Redis connection (default password: `dev_redis_password`) |
| `SESSION_SECRET` | Backend session secret (32+ chars; required in production) |
| `FRONTEND_URL` / `ADMIN_URL` | Backend CORS allowlist |
| `RP_ID` | WebAuthn relying party ID (e.g. `admin.yourdomain.com`) |
| `SENTRY_DSN` / `NUXT_PUBLIC_SENTRY_DSN` | Sentry DSNs (server / client) |
| `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` | Required for `scripts/migrate.sh` |
| `DHGATE_API_KEY` | DHgate affiliate API key |
| `ALIEXPRESS_API_KEY` | AliExpress affiliate API key |
| `AMAZON_ASSOCIATES_TAG` | Amazon Associates tag |
| `WISH_API_KEY` | Wish affiliate API key |
| `DUB_API_KEY` / `DUB_WORKSPACE_ID` | Dub.co affiliate link tracking |

## Code Style Rules

### Formatting
- No semicolons
- Single quotes
- No unnecessary curly braces
- 2-space indentation
- Import order: external → internal → types

### Vue / Nuxt Conventions
- Use `defineNuxtConfig` for config (not raw Nuxt options)
- Use `useRuntimeConfig()` to access env vars in components
- Avoid browser-only code at module level (SSR will fail); guard with `process.client` or `onMounted`
- Composables live in `app/composables/` — auto-imported by Nuxt
- Stores live in `app/stores/` — auto-imported via `@pinia/nuxt`
- Types live in `app/types/`

### Security
- Never commit real secrets — use `.env` (gitignored)
- All user inputs must be validated and sanitized
- CSRF tokens required for state-mutating requests (admin frontend)
- FTC disclosure required on all affiliate links and sponsored content

## Documentation Files

| File | Description |
|------|-------------|
| `README.md` | Main project overview |
| `AGENTS.md` | This file — AI assistant guidance |
| `ADMIN_PANEL_SETUP.md` | WebAuthn setup and admin panel guide |
| `RAILWAY.md` | Railway deployment for backend + both frontends |
| `TEST_COVERAGE_SUMMARY.md` | Test metrics and results |
| `VALIDATION_BUGS_FOUND.md` | Security vulnerabilities documented |
| `SECURITY.md` | Security overview |
| `SECURITY_GUIDE.md` | Detailed security guide |
| `TOUCHID_DEBUG.md` | Touch ID debugging reference |
| `SearchBar_Component_Report.md` | SearchBar component analysis |
| `SEARCHBAR_BASELINE_TEST_RESULTS.md` | SearchBar baseline test results |
| `frontend/FILTERING_SYSTEM.md` | Product filter architecture |
| `frontend/FILTERING_IMPLEMENTATION_REPORT.md` | Filter implementation details |

## Legal Compliance

All affiliate links and sponsored content must include FTC-compliant disclosures stating that the site receives monetary compensation from affiliate programs.

