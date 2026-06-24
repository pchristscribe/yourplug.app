import bcrypt from 'bcryptjs'
import { generateCsrfToken, csrfProtection, adminAuth } from '../../middleware/adminAuth.js'

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', minLength: 1, maxLength: 254 },
      password: { type: 'string', minLength: 1, maxLength: 1024 }
    },
    additionalProperties: false
  }
}

export default async function adminAuthRoutes(fastify, options) {
  const { sql } = fastify

  // Login route
  fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { email: rawEmail, password } = request.body

    // Trim and validate email format
    const email = rawEmail.trim()
    if (!email || !EMAIL_REGEX.test(email)) {
      reply.code(400)
      return {
        error: 'Validation Error',
        message: 'Invalid email format'
      }
    }

    // Find admin by email
    const [admin] = await sql`
      select id, email, password_hash, name, role, is_active
      from admins
      where email = ${email.toLowerCase()}
    `

    if (!admin) {
      reply.code(401)
      return {
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      }
    }

    // Check if admin is active
    if (!admin.isActive) {
      reply.code(403)
      return {
        error: 'Account Inactive',
        message: 'Your admin account has been deactivated'
      }
    }

    // An admin without a password_hash hasn't enrolled the password fallback,
    // so reject with the same generic message used for bad passwords.
    if (!admin.passwordHash) {
      reply.code(401)
      return {
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      }
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash)

    if (!isValidPassword) {
      reply.code(401)
      return {
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      }
    }

    // Update last login
    await sql`
      update admins
      set last_login_at = now()
      where id = ${admin.id}
    `

    // Set session
    request.session.adminId = admin.id

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    }
  })

  // Logout route — requires a valid CSRF token to prevent CSRF-driven session destruction
  fastify.post('/logout', { preHandler: csrfProtection }, async (request, reply) => {
    if (request.session) {
      await request.session.destroy()
    }
    return { success: true, message: 'Logged out successfully' }
  })

  fastify.get('/csrf-token', { preHandler: adminAuth }, async (request, reply) => {
    if (!request.session.csrfToken) {
      request.session.csrfToken = generateCsrfToken()
    }
    return { csrfToken: request.session.csrfToken }
  })

  // Get current session (check if logged in)
  fastify.get('/session', async (request, reply) => {
    if (!request.session || !request.session.adminId) {
      reply.code(401)
      return {
        error: 'Not Authenticated',
        message: 'No active session'
      }
    }

    const [admin] = await sql`
      select id, email, name, role, is_active, last_login_at
      from admins
      where id = ${request.session.adminId}
    `

    if (!admin || !admin.isActive) {
      await request.session.destroy()
      reply.code(401)
      return {
        error: 'Session Invalid',
        message: 'Admin account not found or inactive'
      }
    }

    return {
      authenticated: true,
      admin
    }
  })
}
