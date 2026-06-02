# Swordfighters Admin Panel

WebAuthn-secured admin panel for managing the Swordfighters affiliate marketing platform.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3 + SSR), `compatibilityDate: '2025-11-29'`
- **Port**: 3002 (HMR: 24678)
- **Styling**: Tailwind CSS (shared design system — Dosis font, brand colors)
- **State Management**: Pinia
- **Authentication**: `@simplewebauthn/browser@^13` (WebAuthn passwordless)
- **Data**: Supabase via `@nuxtjs/supabase`
- **Monitoring**: Sentry (`@sentry/nuxt`)
- **Testing**: Vitest + Vue Test Utils + happy-dom
- **Security**: CSRF tokens, CSP headers, input sanitization

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL and Redis running: `docker-compose up -d` from project root
- Backend API running on `http://localhost:3001`

### Development

```bash
npm install
npm run dev   # http://localhost:3002
```

### First-Time Setup

1. Open http://localhost:3002
2. Click **"Register Security Key"**
3. Enter your email and a device name
4. Authenticate with your hardware key or biometric
5. Login using your registered device

## Project Structure

```
admin-frontend/
├── app/
│   ├── components/
│   │   └── DarkModeToggle.vue         # Dark/light mode switcher
│   │
│   ├── composables/
│   │   ├── useCsrf.ts                 # CSRF token — sent as X-CSRF-Token header
│   │   ├── useDarkMode.ts             # Dark mode state + persistence
│   │   └── useSupabaseAdmin.ts        # Supabase admin data utilities
│   │
│   ├── layouts/
│   │   └── default.vue                # Shared layout with sidebar navigation
│   │
│   ├── middleware/
│   │   └── auth.ts                    # Route guard — redirects to /login if unauthenticated
│   │
│   ├── pages/
│   │   ├── index.vue                  # Dashboard
│   │   ├── login.vue                  # WebAuthn login + device registration
│   │   ├── products/index.vue         # Product management (CRUD + bulk ops)
│   │   ├── categories.vue             # Category management (CRUD)
│   │   ├── reviews.vue                # Review moderation (approve/reject)
│   │   ├── diagnostic.vue             # System diagnostics
│   │   └── test-webauthn.vue          # WebAuthn flow testing page
│   │
│   ├── stores/
│   │   └── auth.ts                    # Pinia auth store (session, register, login, logout)
│   │
│   ├── types/
│   │   ├── database.types.ts          # Supabase-generated DB types
│   │   └── supabase.ts                # Supabase client types
│   │
│   └── utils/
│       └── security.ts                # isValidHttpUrl, getSafeImageUrl, sanitizeText
│
├── tests/
│   ├── auth.test.ts                   # WebAuthn store tests (30+ tests)
│   ├── darkMode.test.ts               # Dark mode composable tests
│   └── security.test.ts               # Security utilities tests (70 tests)
│
├── nuxt.config.ts                     # Port, CSP headers, Supabase, runtime config
├── tailwind.config.js                 # Brand colors, Dosis font, dark mode strategy
├── vitest.config.ts                   # Vitest (happy-dom, v8 coverage, path aliases)
├── sentry.client.config.ts
└── sentry.server.config.ts
```

## Testing

```bash
npm test              # all tests
npm run test:watch    # watch mode
npm run test:ui       # Vitest visual UI
npm run test:coverage # coverage report

# specific files
npx vitest tests/auth.test.ts
npx vitest tests/security.test.ts
npx vitest tests/darkMode.test.ts
```

**Test counts**:
- `auth.test.ts` — 30+ tests (WebAuthn flows, validation, SSR safety)
- `security.test.ts` — 70 tests (URL validation, safe image rendering, HTML sanitization)
- `darkMode.test.ts` — toggle, persistence, SSR safety

See [../TEST_COVERAGE_SUMMARY.md](../TEST_COVERAGE_SUMMARY.md) for full details.

## Authentication Flow

```
User enters email
    ↓
auth store: registerSecurityKey(email, deviceName)
    ↓
POST /api/admin/webauthn/register/options  → challenge from backend
    ↓
@simplewebauthn/browser: startRegistration(challenge)
    ↓
Device signs challenge (Touch ID, YubiKey, etc.)
    ↓
POST /api/admin/webauthn/register/verify  → backend stores credential
    ↓
Session established, redirect to dashboard
```

Login flow mirrors registration but uses `/authenticate/options` and `/authenticate/verify`.

## Security Features

| Feature | Implementation |
|---------|---------------|
| WebAuthn auth | `@simplewebauthn/browser`, domain-bound credentials |
| CSRF protection | `useCsrf` composable — `X-CSRF-Token` header on mutations |
| CSP headers | `nuxt.config.ts` — blocks XSS, clickjacking, form hijacking |
| URL validation | `utils/security.ts` — allows only `http:`/`https:` |
| HTML sanitization | `utils/security.ts` — strips `<script>`, `<iframe>`, all tags |
| Route guards | `middleware/auth.ts` — redirects unauthenticated users |
| Session security | Redis-backed, HTTP-only cookies, 7-day expiry |

## Supported Authenticators

**Hardware Keys**: YubiKey (5 Series, Security Key, Bio), Google Titan Key, any FIDO2 key

**Platform Authenticators**:
- macOS: Touch ID (Chrome, Safari, Edge)
- iOS/iPadOS: Face ID / Touch ID (Safari)
- Windows: Windows Hello (Chrome, Edge)
- Android: Fingerprint / Face (Chrome)

## Admin Features

| Page | Features |
|------|---------|
| `/products` | List, create, edit, delete, bulk status/delete, pagination, search |
| `/categories` | List, create, edit, delete; auto-slug; SEO meta description |
| `/reviews` | List, create, edit; approve/reject moderation; pros/cons lists |
| `/diagnostic` | System health, API connectivity checks |
| `/test-webauthn` | Manual WebAuthn flow testing |

## Production Deployment

```bash
npm run build
```

Deploy via Railway (see `RAILWAY.md` in the repo root).

Required environment variables:
```bash
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key
API_BASE_URL=https://api.swordfighters.com
NODE_ENV=production
```

See [../ADMIN_PANEL_SETUP.md](../ADMIN_PANEL_SETUP.md) for the full deployment checklist.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No security keys registered" | Register a key first from the login page |
| "WebAuthn not supported" | Chrome 67+, Safari 13+, Edge 18+ required; HTTPS in production |
| "Invalid session" | Clear cookies, verify Redis is running (`docker-compose ps`) |
| Key not detected | YubiKey: insert & tap; Touch ID: enroll in System Preferences |

## References

- [ADMIN_PANEL_SETUP.md](../ADMIN_PANEL_SETUP.md) — complete setup guide
- [TEST_COVERAGE_SUMMARY.md](../TEST_COVERAGE_SUMMARY.md) — test metrics
- [VALIDATION_BUGS_FOUND.md](../VALIDATION_BUGS_FOUND.md) — security audit results
- [SECURITY_GUIDE.md](../SECURITY_GUIDE.md) — defense-in-depth architecture
- [CLAUDE.md](../CLAUDE.md) — development guidelines
- [SimpleWebAuthn Docs](https://simplewebauthn.dev/)
- [Nuxt 4 Docs](https://nuxt.com/docs)
- [WebAuthn Guide](https://webauthn.guide/)
