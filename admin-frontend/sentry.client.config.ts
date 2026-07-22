import * as Sentry from '@sentry/nuxt'

const isProduction = process.env.NODE_ENV === 'production'

// bare process.env.NUXT_PUBLIC_* is never available in the client bundle (no `process`
// env injection happens there) — import.meta.env.VITE_* is Vite's own static replacement
// and is the only mechanism that reliably works in this file regardless of load timing.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || undefined,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE || undefined,
  enableLogs: true,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],
  tracesSampleRate: isProduction ? 0.1 : 1.0,
  replaysSessionSampleRate: isProduction ? 0.1 : 0,
  replaysOnErrorSampleRate: isProduction ? 1.0 : 0,
  attachStacktrace: true,
  denyUrls: [/extensions\//i, /^chrome:\/\//i],
})
