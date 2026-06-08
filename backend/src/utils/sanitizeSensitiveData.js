// Sensitive field patterns to redact before sending data to Sentry or logging.
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
 * Recursively redact sensitive fields from an object before sending to Sentry.
 * Primitives and non-sensitive keys are returned as-is.
 * @param {any} data - Data to sanitize
 * @param {number} depth - Current recursion depth (guards against circular refs)
 * @returns {any} Sanitized data
 */
export function sanitizeSensitiveData(data, depth = 0) {
  if (depth > 5) return '[Max Depth Reached]'
  if (data === null || data === undefined) return data

  if (Array.isArray(data)) {
    return data.map(item => sanitizeSensitiveData(item, depth + 1))
  }

  if (typeof data === 'object') {
    const sanitized = {}
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      const isSensitive = SENSITIVE_KEYS.some(pattern => lowerKey.includes(pattern))
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

  return data
}
