# Railway Deployment

This repo is a monorepo containing three deployable services. Each service has its own `railway.json` so Railway's Nixpacks builder can build and run it without extra configuration.

| Service          | Directory         | Runtime           | Exposes       |
| ---------------- | ----------------- | ----------------- | ------------- |
| Backend API      | `backend/`        | Node 20 + Fastify | HTTP API      |
| User Frontend    | `frontend/`       | Nuxt 4 SSR        | Public site   |
| Admin Frontend   | `admin-frontend/` | Nuxt 4 SSR        | Admin panel   |

> The backend service was historically deployed as an external service. The config is included here for parity; skip creating the Railway service if you deploy it elsewhere.

## One-time Railway project setup

1. In the Railway dashboard, create a new project and connect it to this GitHub repo.
2. For **each** service you want to deploy, add a new service from the same repo and set:
   - **Root Directory**: `backend`, `frontend`, or `admin-frontend`
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

### Admin Frontend (`admin-frontend/`)

| Variable                     | Required | Notes                                                |
| ---------------------------- | -------- | ---------------------------------------------------- |
| `NUXT_PUBLIC_SUPABASE_URL`   | yes      | Supabase project URL                                 |
| `NUXT_PUBLIC_SUPABASE_KEY`   | yes      | Supabase anon key                                    |
| `NUXT_SUPABASE_SERVICE_KEY`        | yes      | Service role key (admin-only, never expose client)   |
| `NUXT_PUBLIC_API_BASE`       | yes      | Public URL of the backend service                    |
| `NUXT_PUBLIC_SENTRY_DSN`     | no       | Client-side Sentry DSN                               |
| `SENTRY_DSN`                 | no       | SSR Sentry DSN                                       |

Nuxt's Nitro server binds to `0.0.0.0:$PORT` automatically on Railway.

## Build/start commands (for reference)

Each `railway.json` sets:

- **Backend** — build: `pnpm install --frozen-lockfile`, start: `node src/index.js`
- **Frontend / Admin Frontend** — build: `pnpm install --frozen-lockfile && pnpm build`, start: `node .output/server/index.mjs`

## Database migrations

The backend uses [`postgres-js`](https://github.com/porsager/postgres) directly against Supabase Postgres. Schema changes live in `supabase/migrations/` and are applied via the Supabase CLI (see `scripts/migrate.sh`):

```bash
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… ./scripts/migrate.sh
```

This is intentionally a separate step from the Railway deploy — migrations should be reviewed and applied deliberately rather than running on every push.
