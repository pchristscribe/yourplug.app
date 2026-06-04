import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { sanitizeSensitiveData } from './lib/sentry.js'
import { validateSampleRate } from './utils/validateSampleRate.js'

if (process.env.SENTRY_DSN) {
  const isProd = process.env.NODE_ENV === 'production'
  const tracesSampleRate = validateSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, isProd ? 0.1 : 1.0)
  const profilesSampleRate = validateSampleRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, isProd ? 0.1 : 1.0)

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate,
    profilesSampleRate,
    ignoreErrors: [
      'Non-Error promise rejection captured',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
    ],
    beforeSend(event, _hint) {
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
