# Security Policy

## Supported Versions

This project is in active development. Security fixes are applied to the current development branch only.

| Component | Supported |
|-----------|-----------|
| admin-frontend (current) | ✅ |
| frontend (current) | ✅ |
| backend (external service) | ✅ |

## Security Architecture

The yourplug App implements a **defense-in-depth** security model:

1. **WebAuthn Authentication** — passwordless, phishing-resistant, hardware-bound credentials
2. **CSRF Protection** — `X-CSRF-Token` header via `useCsrf` composable on all mutations
3. **Content Security Policy** — configured in `admin-frontend/nuxt.config.ts`; blocks XSS, clickjacking, and unauthorized resource loading
4. **Input Validation + Sanitization** — `admin-frontend/app/utils/security.ts` validates URLs and strips HTML before any API call
5. **Session Security** — Redis-backed, HTTP-only cookies, 7-day expiry
6. **Rate Limiting** — 5 attempts per 15 minutes on WebAuthn endpoints

See [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) for the full defense-in-depth architecture with code examples.

## Known Vulnerabilities

**52 backend validation vulnerabilities** have been identified by the test suite and documented in [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md). These are backend issues (external service) currently pending fixes:
- Type coercion crashes (non-string inputs → 500 instead of 400)
- Missing email format validation
- Whitespace-only inputs accepted
- Missing JSON schema validation on endpoints

Frontend security (both admin and user frontends) is production-ready with all identified vulnerabilities resolved.

## Reporting a Vulnerability

**Contact**: [security@yourplug.app](mailto:security@yourplug.app)

**Include in your report**:
- Description of the vulnerability and affected component
- Steps to reproduce
- Potential impact and attack scenario
- Suggested mitigation (if any)

**Response timeline**:
- Acknowledgment within **48 hours**
- Status update within **7 days**
- Fix timeline communicated based on severity
- Please allow **90 days** before public disclosure (responsible disclosure)

## Severity Classification

| Severity | Examples | Target Fix Time |
|----------|---------|----------------|
| Critical | Auth bypass, data breach, RCE | ASAP (same day if possible) |
| High | XSS, SQL injection, CSRF bypass | Within 7 days |
| Medium | Information disclosure, weak session config | Within 30 days |
| Low | Minor info leaks, best-practice deviations | Next sprint |

## Security Checklist for Contributors

Before submitting a PR that touches security-sensitive code:

- [ ] User inputs validated on both frontend and backend
- [ ] URL inputs validated for protocol (HTTP/HTTPS only) via `isValidHttpUrl()`
- [ ] Text rendered via Vue `{{ }}` interpolation (auto-escaped) — avoid `v-html`
- [ ] New API endpoints require session authentication
- [ ] No secrets hardcoded — use environment variables
- [ ] Rate limiting applied to new auth/mutation endpoints
- [ ] Security tests written (see `admin-frontend/tests/security.test.ts` for examples)
- [ ] No browser-only APIs at module level (SSR safety)

## Security Audit Log

| Date | Type | Scope | Findings |
|------|------|-------|----------|
| 2025-12-09 | Automated tests | Backend validation | 52 vulnerabilities documented |
| 2025-12-12 | Internal review | WebAuthn implementation | 7 bugs fixed |
| 2025-12-26 | Internal review | Admin panel XSS | 3 XSS vectors fixed |
| 2025-12-26 | Automated tests | Frontend security utils | 70 tests — all passing |

## Resources

- [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) — comprehensive security architecture
- [VALIDATION_BUGS_FOUND.md](./VALIDATION_BUGS_FOUND.md) — known backend issues
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [WebAuthn Guide](https://webauthn.guide/)
