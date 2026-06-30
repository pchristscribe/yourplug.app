import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Admin authentication middleware
 * Protects admin routes by checking for valid session
 */
export async function adminAuth(request, reply) {
  if (!request.session || !request.session.adminId) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Please log in to access this resource' })
    return
  }

  const { sql } = request.server
  // is_active → isActive via the global camelCase transform in sql.js
  const [admin] = await sql`
    select id, email, name, role, is_active
    from admins
    where id = ${request.session.adminId}
  `

  if (!admin || !admin.isActive) {
    request.session.destroy()
    reply.code(401).send({ error: 'Unauthorized', message: 'Admin account not found or inactive' })
    return
  }

  request.admin = admin
}

/**
 * CSRF validation middleware
 * Rejects state-mutating requests that are missing a valid X-CSRF-Token header.
 * Safe methods (GET, HEAD, OPTIONS) are exempt.
 * The token must match the value stored in request.session.csrfToken.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function csrfProtection(request, reply) {
  if (SAFE_METHODS.has(request.method)) return

  const sessionToken = request.session && request.session.csrfToken
  const headerToken = request.headers['x-csrf-token']

  const tokensMatch = sessionToken && headerToken &&
    sessionToken.length === headerToken.length &&
    timingSafeEqual(Buffer.from(sessionToken), Buffer.from(headerToken))
  if (!tokensMatch) {
    return reply.code(403).send({ error: 'Forbidden', message: 'Invalid or missing CSRF token' })
  }
}

/**
 * Generates a cryptographically random CSRF token (64 hex chars / 32 bytes).
 * @returns {string}
 */
export function generateCsrfToken() {
  return randomBytes(32).toString('hex')
}
