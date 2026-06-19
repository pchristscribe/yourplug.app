// Sentry onboarding helper — development only; never runs in production.
import { defineEventHandler, createError } from '#imports'

export default defineEventHandler(() => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  throw new Error('Sentry Example API Route Error')
})
