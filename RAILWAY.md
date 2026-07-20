# Railway Deployment

This repo is a monorepo containing four deployable services. Each service has its own `railway.json` so Railway's Nixpacks builder can build and run it without extra configuration.

| Service          | Directory         | Runtime           | Exposes       |
| ---------------- | ----------------- | ----------------- | ------------- |
| Backend API      | `backend/`        | Node 20 + Fastify | HTTP API      |
| User Frontend    | `frontend/`       | Nuxt 4 SSR        | Public site   |
| Admin Frontend   | `admin-frontend/` | Nuxt 4 SSR        | Admin panel   |
| Marketplace      | `marketplace/`    | Nuxt 4 SSR        | Plug Market consignment site |

> The backend service was historically deployed as an external service. The config is included here for parity; skip creating the Railway service if you deploy it elsewhere.

## One-time Railway project setup

1. In the Railway dashboard, create a new project and connect it to this GitHub repo.
2. For **each** service you want to deploy, add a new service from the same repo and set:
   - **Root Directory**: `backend`, `frontend`, `admin-frontend`, or `marketplace`
   - **Config file path**: `railway.json` (default)
3. Add a **Postgres** plugin (used by the backend via `DATABASE_URL`) and a **Redis** plugin (used by the backend via `REDIS_URL`) if you are deploying the backend service here instead of using Supabase/an external Redis.
4. Set the service environment variables described below.

## Environment variables

### Backend (`backend/`)

| Variable              | Required | Notes                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `DATABASE_URL`        | yes      | Supplied by Railway Postgres plugin, or external Supabase Postgres    |
| `REDIS_URL`           | yes      | Supplied by Railway Redis plugin, or external Redis                   |
| `SESSION_SECRET`      | yes      | Random 32+ char string                                                |
| `FRONTEND_URL`        | yes      | Public URL of the user frontend (used for CORS)                       |
| `ADMIN_URL`           | yes      | Public URL of the admin frontend (used for CORS)                      |
| `NODE_ENV`            | yes      | `production`                                                          |
| `SENTRY_DSN`          | no       | Server-side Sentry DSN                                                |
| `SENTRY_ENVIRONMENT`  | no       | Overrides the Sentry `environment` tag; falls back to `NODE_ENV`     |

Railway sets `PORT` automatically; the server binds to `0.0.0.0:$PORT`.

Health check: `GET /health` (returns 200 when Postgres + Redis are reachable).

### User Frontend (`frontend/`)

| Variable                     | Required | Notes                                                |
| ---------------------------- | -------- | ---------------------------------------------------- |
| `NUXT_PUBLIC_SUPABASE_URL`   | yes      | Supabase project URL                                 |
| `NUXT_PUBLIC_SUPABASE_KEY`   | yes      | Supabase anon key                                    |
| `NUXT_PUBLIC_API_BASE`       | yes      | Public URL of the backend service                    |
| `NUXT_PUBLIC_SENTRY_DSN`     | no       | Client-side Sentry DSN                               |
| `SENTRY_DSN`                 | no       | SSR Sentry DSN                                       |
| `SENTRY_ENVIRONMENT`         | no       | SSR Sentry `environment` tag; falls back to `NODE_ENV` |
| `NUXT_PUBLIC_SENTRY_ENVIRONMENT` | no   | Client-side Sentry `environment` tag; falls back to `NODE_ENV` |
| `SENTRY_AUTH_TOKEN`          | no       | Required in production for readable (non-minified) stack traces — enables source-map upload during build |

### Admin Frontend (`admin-frontend/`)

| Variable                     | Required | Notes                                                |
| ---------------------------- | -------- | ---------------------------------------------------- |
| `NUXT_PUBLIC_SUPABASE_URL`   | yes      | Supabase project URL                                 |
| `NUXT_PUBLIC_SUPABASE_KEY`   | yes      | Supabase anon key                                    |
| `SUPABASE_SECRET_KEY`        | yes      | Service role key (admin-only, never expose client)   |
| `NUXT_PUBLIC_API_BASE`       | yes      | Public URL of the backend service                    |
| `NUXT_PUBLIC_SENTRY_DSN`     | no       | Client-side Sentry DSN                               |
| `SENTRY_DSN`                 | no       | SSR Sentry DSN                                       |
| `SENTRY_ENVIRONMENT`         | no       | SSR Sentry `environment` tag; falls back to `NODE_ENV` |
| `NUXT_PUBLIC_SENTRY_ENVIRONMENT` | no   | Client-side Sentry `environment` tag; falls back to `NODE_ENV` |
| `SENTRY_AUTH_TOKEN`          | no       | Required in production for readable (non-minified) stack traces — enables source-map upload during build |

### Marketplace (`marketplace/`)

| Variable                     | Required | Notes                                                |
| ---------------------------- | -------- | ---------------------------------------------------- |
| `NUXT_PUBLIC_SUPABASE_URL`   | yes      | Supabase project URL                                 |
| `NUXT_PUBLIC_SUPABASE_KEY`   | yes      | Supabase anon key                                    |
| `NUXT_PUBLIC_API_BASE`       | yes      | Public URL of the backend service                    |
| `STRIPE_SECRET_KEY`          | yes      | Stripe Connect secret key (seller onboarding)         |
| `STRIPE_PUBLISHABLE_KEY`     | yes      | Stripe Connect publishable key                        |
| `STRIPE_WEBHOOK_SECRET`      | yes      | Stripe webhook signing secret                          |
| `STRIPE_CONNECT_CLIENT_ID`   | yes      | Stripe Connect OAuth client ID                         |
| `NUXT_PUBLIC_SENTRY_DSN`     | no       | Client-side Sentry DSN                               |
| `SENTRY_DSN`                 | no       | SSR Sentry DSN                                       |
| `SENTRY_ENVIRONMENT`         | no       | SSR Sentry `environment` tag; falls back to `NODE_ENV` |
| `NUXT_PUBLIC_SENTRY_ENVIRONMENT` | no   | Client-side Sentry `environment` tag; falls back to `NODE_ENV` |
| `SENTRY_AUTH_TOKEN`          | no       | Required in production for readable (non-minified) stack traces — enables source-map upload during build |

Nuxt's Nitro server binds to `0.0.0.0:$PORT` automatically on Railway.

## Build/start commands (for reference)

Each `railway.json` sets:

- **Backend** — build: `pnpm install --frozen-lockfile`, start: `node --import ./src/instrument.js src/index.js` (the `--import` flag loads Sentry before any other code runs)
- **Frontend / Admin Frontend / Marketplace** — build: `pnpm install --frozen-lockfile && pnpm build`, start: `node .output/server/index.mjs`

## Database migrations

The backend uses [`postgres-js`](https://github.com/porsager/postgres) directly against Supabase Postgres. Schema changes live in `supabase/migrations/` and are applied via the Supabase CLI (see `scripts/migrate.sh`):

```bash
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… ./scripts/migrate.sh
```

This is intentionally a separate step from the Railway deploy — migrations should be reviewed and applied deliberately rather than running on every push.
