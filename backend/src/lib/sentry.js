import * as Sentry from '@sentry/node'

// Sensitive field patterns to redact
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'api-key',
  'auth',
  'authorization',
  'cookie',
  'session',
  'sessionid',
  'csrf',
  'xsrf',
  'private',
  'credential',
  'card',
  'ccn',
  'cvv',
  'cvc',
  'ssn',
  'pin',
  'salt',
]

/**
 * Sanitize sensitive data from objects before sending to Sentry
 * @param {any} data - Data to sanitize
 * @param {number} depth - Current recursion depth
 * @returns {any} - Sanitized data
 */
export function sanitizeSensitiveData(data, depth = 0) {
  // Prevent infinite recursion
  if (depth > 5) return '[Max Depth Reached]'

  // Handle null/undefined
  if (data === null || data === undefined) return data

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeSensitiveData(item, depth + 1))
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized = {}
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()

      // Check if key contains sensitive pattern
      const isSensitive = SENSITIVE_KEYS.some(pattern => lowerKey.includes(pattern))

      // If the key is sensitive and the value is a primitive, redact it
      // If the key is sensitive but the value is an object/array, still recurse into it
      // to handle nested fields properly (e.g., credentials: { password: 'x' })
      if (isSensitive && (typeof value !== 'object' || value === null)) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeSensitiveData(value, depth + 1)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  // Return primitives as-is
  return data
}

/**
 * Register Sentry context hooks on the Fastify instance.
 * Sentry.init() is called earlier via --import ./src/instrument.js.
 * @param {Object} fastify - Fastify instance
 */
export function initSentry(fastify) {
  if (!process.env.SENTRY_DSN) {
    fastify.log.warn('SENTRY_DSN not configured - Sentry monitoring disabled')
    return
  }
  fastify.log.info(`Sentry active (env: ${process.env.NODE_ENV || 'development'})`)
}

/**
 * Capture exception and send to Sentry
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context (will be sanitized)
 */
export function captureException(error, context = {}) {
  Sentry.withScope((scope) => {
    // Add custom context (sanitized)
    if (context.user) {
      scope.setUser(sanitizeSensitiveData(context.user))
    }
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }
    if (context.extra) {
      // Sanitize extra context before sending
      scope.setContext('additional', sanitizeSensitiveData(context.extra))
    }

    Sentry.captureException(error)
  })
}

/**
 * Capture a message and send to Sentry
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (fatal, error, warning, info, debug)
 */
export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * Flush Sentry events (useful for graceful shutdown)
 * @param {number} timeout - Timeout in milliseconds
 */
export async function flushSentry(timeout = 2000) {
  if (process.env.SENTRY_DSN) {
    await Sentry.close(timeout)
  }
}

export default Sentry
