# yourplug Admin Panel — Setup Guide

## Overview

The admin panel uses **WebAuthn** for passwordless authentication with hardware security keys and biometric authentication. This provides phishing-resistant, hardware-backed authentication similar to SSH/GPG keys but designed for web browsers.

## What is WebAuthn?

WebAuthn (Web Authentication API) is a W3C web standard for secure, phishing-resistant authentication using:
- **Hardware security keys** (YubiKey, Titan Key, any FIDO2 key)
- **Platform authenticators** (Touch ID, Face ID, Windows Hello, Android biometrics)
- **Public-key cryptography** — credentials are device-bound and domain-bound

## Architecture

### Admin Frontend (`admin-frontend/`)
- **Framework**: Nuxt 4 (Vue 3 + SSR)
- **Port**: 3002
- **Auth library**: `@simplewebauthn/browser@^13`
- **State**: Pinia (`stores/auth.ts`)
- **Security utilities**: `utils/security.ts`
- **Composables**: `useCsrf` (CSRF token), `useDarkMode`, `useRateLimit`, `useSupabaseAdmin`, `useAdminCrudList`
- **CSP**: Configured in `nuxt.config.ts` — blocks XSS, clickjacking, and form hijacking
- **Supabase**: `@nuxtjs/supabase` for data layer

### Backend API (`backend/`)
- **Framework**: Fastify 5
- **Database**: PostgreSQL via `postgres-js` (direct SQL queries against Supabase Postgres — no ORM; schema lives in `supabase/migrations/`)
- **Sessions**: Redis-backed
- **Auth library**: `@simplewebauthn/server`
- **Default URL**: `http://localhost:3001`
## Quick Start

### 1. Start Infrastructure

```bash
# From project root
docker-compose up -d
docker-compose ps   # verify postgres + redis are healthy
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and set NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_KEY, API_BASE_URL
```

### 3. Start Backend API

```bash
cd backend
pnpm install
pnpm dev      # runs on http://localhost:3001
```

### 4. Start Admin Frontend

```bash
cd admin-frontend
pnpm install
pnpm dev      # runs on http://localhost:3002
```

### 5. Bootstrap the First Admin Account

The backend blocks auto-creation of admin accounts in production (prevents arbitrary callers from claiming superadmin access). Before you can log in to a fresh production environment, you need at least one row in the `admins` table.

**Option A — psql one-liner (recommended)**

```bash
psql "$DATABASE_URL" -c "
  INSERT INTO admins (email, name, role, is_active)
  VALUES ('your-email@example.com', 'Your Name', 'admin', true)
  ON CONFLICT (email) DO NOTHING;
"
```

**Option B — Railway console**

Open the Railway dashboard → your backend service → **Connect** → run the same SQL in the query console.

After inserting the row, proceed to register your security key (step 6 below). The `/register/options` endpoint will find the row and return a WebAuthn challenge.

> **Local development**: The backend auto-creates the admin row when `NODE_ENV` is not `production`, so no manual step is needed for local dev.

---

### 6. Register Your First Security Key

1. Open **http://localhost:3002**
2. Click **"Register Security Key"**
3. Enter your email (e.g., `admin@yourplug.app`)
4. Enter a device name (e.g., `MacBook Touch ID` or `YubiKey 5`)
5. Authenticate with your device:
   - **YubiKey**: Insert and tap the button
   - **Touch ID**: Touch the fingerprint sensor
   - **Face ID**: Look at the camera
   - **Windows Hello**: Use fingerprint/face/PIN

### 6. Login

1. Enter your email
2. Click **"Sign in with Security Key"**
3. Authenticate with your registered device

## Supported Authenticators

**Hardware Security Keys**
- YubiKey (5 Series, Security Key Series, Bio Series)
- Google Titan Key
- Any FIDO2 / WebAuthn-compliant key

**Platform Authenticators**
- macOS: Touch ID (Chrome, Safari, Edge)
- iOS/iPadOS: Face ID / Touch ID (Safari)
- Windows: Windows Hello (Chrome, Edge)
- Android: Fingerprint / Face unlock (Chrome)

## Project Structure

```
admin-frontend/
├── app/
│   ├── components/
│   │   └── DarkModeToggle.vue
│   ├── composables/
│   │   ├── useAdminCrudList.ts    # Shared pagination/modal state for the CRUD pages
│   │   ├── useCsrf.ts             # CSRF token management
│   │   ├── useDarkMode.ts         # Dark/light mode toggle
│   │   ├── useRateLimit.ts        # Client-side rate limiter (5/min, 5-min lockout)
│   │   └── useSupabaseAdmin.ts    # Supabase admin utilities
│   ├── layouts/
│   │   └── default.vue            # Shared layout with sidebar nav
│   ├── middleware/
│   │   └── auth.ts                # Route guard — redirects to /login if not authenticated
│   ├── pages/
│   │   ├── index.vue              # Dashboard
│   │   ├── login.vue              # WebAuthn / password login + registration
│   │   ├── products/index.vue     # Product management CRUD
│   │   ├── categories.vue         # Category management CRUD
│   │   ├── reviews.vue            # Review moderation
│   │   ├── consignment.vue        # Consignment listing moderation queue
│   │   ├── diagnostic.vue         # WebAuthn/browser diagnostics
│   │   └── test-webauthn.vue      # WebAuthn flow testing
│   ├── stores/
│   │   └── auth.ts                # Pinia auth store (session, register, login, logout)
│   ├── types/
│   │   ├── database.types.ts      # Supabase-generated DB types
│   │   └── supabase.ts            # Supabase client types
│   └── utils/
│       └── security.ts            # isValidHttpUrl, getSafeImageUrl, sanitizeText
├── tests/                         # 13 files, ~290 tests — see TEST_COVERAGE_SUMMARY.md
├── nuxt.config.ts                 # Nuxt config (CSP headers, Supabase, runtime config)
├── tailwind.config.js             # Tailwind with brand design system
├── vitest.config.ts               # Vitest (happy-dom, v8 coverage)
├── sentry.client.config.ts        # Sentry client-side config
└── sentry.server.config.ts        # Sentry server-side config
```

## Admin Panel Features

### Product Management (`/products`)

Full CRUD interface for the product catalog:

| Feature | Description |
|---------|-------------|
| Product list | Paginated, searchable, filterable by platform/status/category |
| Create product | Modal form with all fields and validation |
| Edit product | In-place editing with category dropdown and tag management |
| Delete product | Confirmation modal — prevents accidental deletion |
| Bulk operations | Select multiple products for status update or bulk delete |
| Form protection | Disabled buttons + loading states during API calls |

**Product fields**: Title, Platform (DHgate/AliExpress/Amazon/Wish), Description, Image URL, Price, Currency, Status (Active/Inactive/Out of Stock), Category, External ID, Rating, Review Count, Tags.

### Category Management (`/categories`)

| Feature | Description |
|---------|-------------|
| Category list | All categories with product counts |
| Create/edit | Modal with name, slug, description, meta description (SEO) |
| Delete | Safe deletion with confirmation |
| Slug generation | Auto-generated from name |

### Review Management (`/reviews`)

| Feature | Description |
|---------|-------------|
| Review list | All reviews with product association |
| Create/edit | Rich form with dynamic pros/cons lists |
| Moderation | Approve/Reject/Pending status workflow |
| Product link | Dropdown to associate with products |

**Review fields**: Product, Author Name, Rating (1–5), Title, Content, Pros/Cons lists, Status, Verified Purchase flag.

### Security Features

1. **WebAuthn**: Phishing-resistant, hardware-backed authentication — credentials are domain-bound
2. **Replay protection**: Signature counters prevent credential reuse
3. **CSRF tokens**: `useCsrf` composable sends `X-CSRF-Token` on all state-changing requests
4. **CSP headers**: Restricts script sources, blocks clickjacking, prevents form hijacking
5. **Session security**: Redis-backed, 7-day expiration, HTTP-only cookies
6. **Input sanitization**: `utils/security.ts` validates URLs and strips HTML before API calls

## WebAuthn API Endpoints (Backend)

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/webauthn/register/options` | Get registration challenge |
| POST | `/api/admin/webauthn/register/verify` | Complete registration |
| POST | `/api/admin/webauthn/authenticate/options` | Get login challenge |
| POST | `/api/admin/webauthn/authenticate/verify` | Complete login |
| GET | `/api/admin/webauthn/credentials` | List registered keys |
| DELETE | `/api/admin/webauthn/credentials/:id` | Remove a key |

### Admin CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/products` | List / create products |
| GET/PATCH/DELETE | `/api/admin/products/:id` | Get / update / delete product |
| POST | `/api/admin/products/bulk/status` | Bulk status update |
| POST | `/api/admin/products/bulk/delete` | Bulk delete |
| GET | `/api/admin/products/stats/dashboard` | Dashboard statistics |
| GET/POST | `/api/admin/categories` | List / create categories |
| GET/POST | `/api/admin/reviews` | List / create reviews |

## Database Schema

The backend uses raw SQL migrations via `postgres-js` (no ORM/Prisma — see `CLAUDE.md`). Schema source of truth: `supabase/migrations/002_alter_admins_and_credentials.sql` and `005_admin_webauthn.sql`.

- **`admins`** — `id`, `email` (unique), `name`, `role`, `password_hash` (nullable — only set if the password fallback is enrolled), `is_active`, `last_login_at`, `current_challenge` / `challenge_expires_at` (active WebAuthn challenge, 5-min TTL)
- **`webauthn_credentials`** — `id`, `admin_id` (FK → `admins`), `credential_id` (unique), `public_key`, `counter` (replay protection), `device_name`, `transports` (`usb`/`nfc`/`ble`/`internal`/`hybrid`), `last_used_at`, `created_at`

## Running Tests

```bash
cd admin-frontend

pnpm test              # All tests
pnpm test:watch        # Watch mode
pnpm test:ui           # Visual Vitest UI
pnpm test:coverage     # Coverage report (v8 provider)

# Run specific file
pnpm vitest tests/security.test.ts
pnpm vitest tests/auth.test.ts
```

See [TEST_COVERAGE_SUMMARY.md](./TEST_COVERAGE_SUMMARY.md) for the current per-file breakdown and test counts.

## Production Deployment

### Environment Variables

```bash
# Supabase
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key

# Backend API
API_BASE_URL=https://api.yourplug.app

# WebAuthn (backend)
RP_ID=yourplug.app
ADMIN_URL=https://admin.yourplug.app

# Session
SESSION_SECRET=<generate-64-character-secret>
NODE_ENV=production
```

### Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `SESSION_SECRET` (64+ characters)
- [ ] Set correct `RP_ID` to match your production domain
- [ ] Set `ADMIN_URL` to your admin subdomain (HTTPS required)
- [ ] Set all Supabase credentials
- [ ] Deploy backend to Railway
- [ ] Deploy admin frontend to Railway (see `RAILWAY.md`)
- [ ] Configure CORS to allow your admin domain
- [ ] Test WebAuthn registration on production domain
- [ ] Register at least 2 security keys (primary + backup)

## Managing Security Keys

### Register Backup Devices (Recommended)

Register at least two authenticators for redundancy:
1. Login to admin panel
2. Go to Settings → Security Keys
3. Register your backup device (e.g., iPhone Face ID as backup to MacBook Touch ID)

### Remove Compromised Keys

If a key is lost or stolen:
1. Login with another registered key
2. Go to Settings → Security Keys
3. Delete the compromised key
4. The system prevents deleting your last key

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No security keys registered" | Register a key first via the login page |
| "WebAuthn not supported" | Update browser (Chrome 67+, Safari 13+, Edge 18+); HTTPS required in production |
| "Invalid authentication session" | Clear cookies, check Redis is running (`docker-compose ps`) |
| Security key not detected | YubiKey: insert and tap; Touch ID: enroll in System Preferences; Windows Hello: enable in Settings |
| 500 errors on registration | Check backend is running at `API_BASE_URL` |

## Browser Compatibility

| Browser | Platform | Support |
|---------|----------|---------|
| Chrome 67+ | All | Full |
| Edge 18+ | Windows/macOS | Full |
| Safari 13+ | macOS/iOS | Full |
| Firefox 60+ | All | Full |

## Security Audit History

| Date | Type | Findings | Status |
|------|------|----------|--------|
| 2025-12-09 | Automated | 52 validation vulnerabilities identified | Documented in VALIDATION_BUGS_FOUND.md |
| 2025-12-12 | Internal | 7 WebAuthn validation bugs | Fixed |
| 2025-12-26 | Internal | 3 XSS vulnerabilities in admin CRUD | Fixed |
| 2025-12-26 | Automated | 70 security tests created | Passing |

See [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md) and [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) for full details.

## References

- [WebAuthn Guide](https://webauthn.guide/)
- [SimpleWebAuthn Documentation](https://simplewebauthn.dev/)
- [Nuxt 4 Documentation](https://nuxt.com/docs)
- [Vitest Documentation](https://vitest.dev/)
- [TEST_COVERAGE_SUMMARY.md](./TEST_COVERAGE_SUMMARY.md)
- [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)
