FROM node:24-alpine AS base
WORKDIR /app

# Install dependencies separately for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm install --frozen-lockfile --prod

# Copy source
COPY . .

# ── API server ────────────────────────────────────────────────────────────
FROM base AS api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "--import", "./src/instrument.js", "src/index.js"]

# ── Background worker ─────────────────────────────────────────────────────
FROM base AS worker
CMD ["node", "--import", "./src/instrument.js", "src/workers/index.js"]
