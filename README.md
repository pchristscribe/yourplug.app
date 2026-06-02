# Swordfighters App

An affiliate marketing platform targeting gay men, curating products from DHgate, AliExpress, Amazon, and Wish. Features product reviews, seasonal recommendations, and FTC-compliant affiliate disclosures.

## Quick Start

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Start infrastructure (PostgreSQL & Redis)
docker-compose up -d

# 3. Start admin frontend (Port 3002)
cd admin-frontend && npm install && npm run dev

# 4. Start user frontend (Port 3000)
cd frontend && npm install && npm run dev
```

## Project Structure

```
swordfighters-fullstack/
├── admin-frontend/            # Admin panel — WebAuthn authentication (Port 3002)
│   ├── app/
│   │   ├── components/        # DarkModeToggle
│   │   ├── composables/       # useCsrf, useDarkMode, useSupabaseAdmin
│   │   ├── layouts/           # default.vue
│   │   ├── middleware/        # auth.ts (route guard)
│   │   ├── pages/             # dashboard, login, products, categories, reviews, diagnostic
│   │   ├── stores/            # auth.ts (Pinia)
│   │   ├── types/             # database.types.ts, supabase.ts
│   │   └── utils/             # security.ts
│   └── tests/                 # auth, darkMode, security test suites
│
├── frontend/                  # User-facing product catalog (Port 3000)
│   ├── app/
│   │   ├── components/        # ProductCard, SearchBar, filters/, feedback/
│   │   ├── composables/       # useDarkMode, useApi, useToast, useSupabaseProducts
│   │   ├── layouts/           # default.vue
│   │   ├── pages/             # index, products/[id], search-demo
│   │   ├── stores/            # filters.ts, cart.ts, products.ts (Pinia)
│   │   └── types/             # index.ts, filters.ts, database.types.ts, supabase.ts
│   └── tests/                 # 10 test files covering components, stores, composables
│
├── backend/                   # Backend API (external service — not actively developed here)
├── backend-security-reference/ # Security reference implementation (middleware, routes, utils)
├── mcp-dhgate/                # DHgate MCP server for product scraping
├── supabase/migrations/       # Database migration files
├── .github/                   # CI/CD workflows + issue templates
├── docker-compose.yml         # PostgreSQL 16 + Redis 7
└── .env.example               # Environment variable template
```

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Admin Frontend | Nuxt 4, Vue 3, Pinia, Tailwind CSS, `@simplewebauthn/browser` |
| User Frontend | Nuxt 4, Vue 3, Pinia, Tailwind CSS, Headless UI |
| Database | Supabase (PostgreSQL) — `@nuxtjs/supabase` in both frontends |
| Monitoring | Sentry (`@sentry/nuxt`) in both frontends |
| Testing | Vitest + Vue Test Utils + happy-dom |
| Infrastructure | Docker Compose (PostgreSQL 16 + Redis 7) |
| Backend API | Fastify + Prisma (external service) |

### Admin Panel (`admin-frontend/`)

- **Authentication**: WebAuthn passwordless login — hardware keys (YubiKey), Touch ID, Face ID, Windows Hello
- **CSRF protection**: `useCsrf` composable sends `X-CSRF-Token` on all mutations
- **CSP headers**: Configured in `nuxt.config.ts` — prevents XSS, clickjacking, and unauthorized resource loading
- **Pages**: Dashboard, Products CRUD, Categories CRUD, Reviews moderation, Diagnostic, WebAuthn test
- **Port**: 3002 | HMR: 24678

### User Frontend (`frontend/`)

- **Product catalog** with category, platform, price range, rating filters + sorting
- **URL-synced filters**: Filter state serializes to/from query params for shareable links
- **Components**: ProductCard, ProductGrid, SearchBar, Pagination, filter sidebar, toast/modal/alert feedback
- **Headless UI**: Accessible components via `nuxt-headlessui` (prefix: `Headless`)
- **Port**: 3000 | HMR: 24677

### Design System (shared)

Both frontends use identical Tailwind config:
- **Font**: Dosis (variable weight 200–800, Google Fonts)
- **Colors**: `brand` (#8B1E2D), `accent` (#D6A77A), `surface`, `ink`, `status` variants
- **Dark mode**: `class` strategy via `useDarkMode` composable + `DarkModeToggle.vue`

## Running Tests

```bash
# Admin frontend
cd admin-frontend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest visual UI
npm run test:coverage # Coverage report

# User frontend
cd frontend
npm test
npm run test:watch
npm run test:ui
npm run test:coverage
```

**Test suite stats**: 13 test files, ~66 tests across auth, security, components, stores, and composables.
See [TEST_COVERAGE_SUMMARY.md](./TEST_COVERAGE_SUMMARY.md) for detailed metrics.

## Development Workflow

### 1. Infrastructure

```bash
docker-compose up -d     # Start PostgreSQL + Redis
docker-compose ps        # Check health
docker-compose down      # Stop
docker-compose down -v   # Stop and delete volumes (⚠️ data loss)
```

### 2. Database Access

```bash
# PostgreSQL shell
docker exec -it swordfighters-postgres psql -U swordfighters -d swordfighters_db

# Redis CLI
docker exec -it swordfighters-redis redis-cli -a dev_redis_password
```

### 3. Environment Variables

Key variables (full list in `.env.example`):

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NUXT_PUBLIC_SUPABASE_KEY` | Supabase anon key |
| `SUPABASE_SECRET_KEY` | Service role key (admin only) |
| `API_BASE_URL` | Backend API base URL |
| `DATABASE_URL` | PostgreSQL connection string |

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `main.yml` — main pipeline
- `claude.yml` — Claude Code integration
- `claude-code-review.yml` — automated PR review
- `eslint.yml` — linting checks

## Production Deployment

| Service | Platform |
|---------|---------|
| Admin Frontend | Railway |
| User Frontend | Railway |
| Backend API | Railway |
| Database | Supabase |
| Monitoring | Sentry |
| Scraping Jobs | GitHub Actions + Bull queue |

See [ADMIN_PANEL_SETUP.md](./ADMIN_PANEL_SETUP.md) for production environment variables and deployment checklist.

## Documentation

| File | Description |
|------|-------------|
| [CLAUDE.md](./CLAUDE.md) | AI assistant guidelines and codebase reference |
| [ADMIN_PANEL_SETUP.md](./ADMIN_PANEL_SETUP.md) | WebAuthn setup and admin panel guide |
| [TEST_COVERAGE_SUMMARY.md](./TEST_COVERAGE_SUMMARY.md) | Test metrics and coverage details |
| [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md) | Security vulnerabilities identified by tests |
| [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) | Defense-in-depth security architecture |
| [frontend/FILTERING_SYSTEM.md](./frontend/FILTERING_SYSTEM.md) | Product filter system architecture |
| [admin-frontend/README.md](./admin-frontend/README.md) | Admin panel setup |
| [frontend/README.md](./frontend/README.md) | User frontend setup |
| [mcp-dhgate/README.md](./mcp-dhgate/README.md) | DHgate MCP server |

## Code Style

- No semicolons, single quotes, 2-space indentation
- No unnecessary curly braces
- Import order: external → internal → types
- All inputs validated at system boundaries
- No browser-only code at module level (SSR safety)

## Security

- **WebAuthn**: Phishing-resistant passwordless auth (no passwords stored)
- **CSP headers**: Configured in admin frontend `nuxt.config.ts`
- **CSRF**: Token-based protection via `useCsrf` composable
- **Input sanitization**: `utils/security.ts` — URL validation, HTML stripping
- **Known issues**: Documented in [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md)

## Legal

All affiliate links and sponsored content include FTC-compliant disclosures indicating monetary compensation from affiliate programs.

---

**Status**: Active Development
