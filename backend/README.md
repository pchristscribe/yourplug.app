# swordfighters-backend

Fastify API for the Swordfighters affiliate marketing platform. Requires Node.js ≥ 24 and a running PostgreSQL + Redis instance (see `docker-compose.yml` in the repo root).

## Install

```bash
pnpm install
```

## Run

```bash
# Development (auto-restart on file changes)
pnpm dev

# Production
pnpm start
```

## Test

```bash
pnpm test
```

See the root `CLAUDE.md` and `RAILWAY.md` for full environment variable documentation and deployment instructions.
