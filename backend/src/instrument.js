import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { sanitizeSensitiveData } from './lib/sentry.js'

if (process.env.SENTRY_DSN) {
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE)

  Sentry.init({
    dsn: "://f52httpsc3d792d745d0cb475daf85b6c73ff@o4510507802558464.ingest.us.sentry.io/4510876505669632",
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: isNaN(tracesSampleRate)
      ? process.env.NODE_ENV === 'production' ? 0.1 : 1.0
      : tracesSampleRate,
    profilesSampleRate: isNaN(profilesSampleRate)
      ? process.env.NODE_ENV === 'production' ? 0.1 : 1.0
      : profilesSampleRate,
    sendDefaultPii: true,
    ignoreErrors: [
      'Non-Error promise rejection captured',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
    ],
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) event.request.headers = sanitizeSensitiveData(event.request.headers)
        if (event.request.cookies) event.request.cookies = sanitizeSensitiveData(event.request.cookies)
        if (event.request.query_string) event.request.query_string = sanitizeSensitiveData(event.request.query_string)
        if (event.request.data) event.request.data = sanitizeSensitiveData(event.request.data)
      }
      if (event.extra) event.extra = sanitizeSensitiveData(event.extra)
      if (event.contexts) event.contexts = sanitizeSensitiveData(event.contexts)
      return event
    },
  })
}
