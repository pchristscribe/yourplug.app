import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { isValidChallenge } from '../../utils/cleanupExpiredChallenges.js'
import { UUID_RE } from '../../utils/constants.js'
import { csrfProtection } from '../../middleware/adminAuth.js'

const RP_NAME = 'yourplug Admin'
const RP_ID = process.env.NODE_ENV === 'production'
  ? process.env.RP_ID || 'yourplug.app'
  : 'localhost'
const ORIGIN = process.env.NODE_ENV === 'production'
  ? process.env.ADMIN_URL || 'https://admin.yourplug.app'
  : 'http://localhost:3002'

// Email validation regex - RFC 5322 simplified
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(email) {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' }
  }

  const trimmed = email.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' }
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' }
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' }
  }

  return { valid: true, email: trimmed.toLowerCase() }
}

const registerOptionsSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', minLength: 1, maxLength: 254 },
      inviteToken: { type: 'string', minLength: 1, maxLength: 255 }
    },
    additionalProperties: false
  }
}

const registerVerifySchema = {
  body: {
    type: 'object',
    required: ['email', 'credential'],
    properties: {
      email: { type: 'string', minLength: 1, maxLength: 254 },
      credential: { type: 'object' },
      deviceName: { type: 'string', maxLength: 100 }
    },
    additionalProperties: false
  }
}

const authenticateOptionsSchema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', minLength: 1, maxLength: 254 }
    },
    additionalProperties: false
  }
}

const authenticateVerifySchema = {
  body: {
    type: 'object',
    required: ['email', 'credential'],
    properties: {
      email: { type: 'string', minLength: 1, maxLength: 254 },
      credential: { type: 'object' }
    },
    additionalProperties: false
  }
}

async function loadAdminByEmail(sql, email) {
  const [admin] = await sql`
    select id, email, name, role, is_active, current_challenge, challenge_expires_at
    from admins where email = ${email}
  `
  if (!admin) return null
  const credentials = await sql`
    select id, credential_id, public_key, counter, transports
    from webauthn_credentials where admin_id = ${admin.id}
  `
  return { ...admin, webauthnCredentials: credentials }
}

export default async function webauthnRoutes(fastify, options) {
  const { sql } = fastify

  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      reply.code(400).send({
        error: 'Validation error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Invalid request data'
      })
      return
    }
    throw error
  })

  // Step 1: Generate registration options
  fastify.post('/register/options', { schema: registerOptionsSchema }, async (request, reply) => {
    try {
      fastify.log.info('Registration options request received')

      const emailValidation = validateEmail(request.body.email)
      if (!emailValidation.valid) {
        fastify.log.warn({ error: emailValidation.error }, 'Registration options: Invalid email')
        reply.code(400)
        return { error: emailValidation.error }
      }

      const email = emailValidation.email
      fastify.log.info({ email }, 'Looking up admin by email')

      let admin = await loadAdminByEmail(sql, email)

      if (!admin) {
        if (process.env.NODE_ENV === 'production') {
          fastify.log.warn({ email }, 'Registration attempted for unknown email in production')
          reply.code(403)
          return { error: 'Admin account not found. Contact an existing administrator.' }
        }
        fastify.log.info({ email }, 'Creating new admin (dev/test bootstrap)')
        const [created] = await sql`
          insert into admins ${sql({
            email,
            name: email.split('@')[0],
            role: 'admin',
            is_active: true
          })}
          returning *
        `
        admin = { ...created, webauthnCredentials: [] }
        fastify.log.info({ adminId: admin.id }, 'Admin created successfully')
      } else {
        fastify.log.info(
          { adminId: admin.id, credentialCount: admin.webauthnCredentials.length },
          'Admin found'
        )
      }

      const userIdBuffer = new TextEncoder().encode(admin.id)

      const validCredentials = admin.webauthnCredentials.filter(
        cred => cred.credentialId && typeof cred.credentialId === 'string' && cred.credentialId.length > 0
      )

      fastify.log.info({
        validCredentialCount: validCredentials.length,
        rpName: RP_NAME,
        rpID: RP_ID
      }, 'Generating registration options')

      const registrationOptions = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: userIdBuffer,
        userName: admin.email,
        userDisplayName: admin.name,
        attestationType: 'none',
        excludeCredentials: validCredentials.map(cred => ({
          id: cred.credentialId,
          type: 'public-key',
          transports: cred.transports
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred'
        }
      })

      fastify.log.info({ challengeLength: registrationOptions.challenge.length }, 'Storing challenge')

      const challengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000)
      await sql`
        update admins
        set current_challenge = ${registrationOptions.challenge},
            challenge_expires_at = ${challengeExpiresAt}
        where id = ${admin.id}
      `

      fastify.log.info('Registration options generated successfully')
      return registrationOptions
    } catch (error) {
      fastify.log.error({
        error: error.message,
        stack: error.stack,
        name: error.name
      }, 'Error generating registration options')
      reply.code(500)
      return {
        error: 'Failed to generate registration options',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }
  })

  // Step 2: Verify registration response and store credential
  fastify.post('/register/verify', { schema: registerVerifySchema }, async (request, reply) => {
    try {
      const emailValidation = validateEmail(request.body.email)
      if (!emailValidation.valid) {
        reply.code(400)
        return { error: emailValidation.error }
      }

      const email = emailValidation.email
      const { credential, deviceName } = request.body

      if (!credential || typeof credential !== 'object') {
        reply.code(400)
        return { error: 'Valid credential object is required' }
      }

      const [admin] = await sql`
        select id, email, name, role, is_active, current_challenge, challenge_expires_at
        from admins where email = ${email}
      `

      if (!admin || !admin.currentChallenge) {
        reply.code(400)
        return { error: 'Invalid registration session' }
      }

      if (!isValidChallenge(admin)) {
        reply.code(400)
        return { error: 'Registration challenge has expired. Please try again.' }
      }

      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: admin.currentChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID
      })

      if (!verification.verified || !verification.registrationInfo) {
        reply.code(400)
        return { error: 'Verification failed' }
      }

      const { credential: credentialData } = verification.registrationInfo

      fastify.log.info({
        registrationInfo: verification.registrationInfo,
        credentialId: credential.id,
        credentialDataId: credentialData?.id
      }, 'Registration info received')

      if (!credentialData) {
        reply.code(400)
        return { error: 'Missing credential data' }
      }

      const credentialId = credential.id

      if (!credentialId || credentialId.length === 0) {
        fastify.log.error({ credential, credentialData }, 'Missing credential ID')
        reply.code(400)
        return { error: 'Missing credential ID' }
      }

      const sanitizedDeviceName = typeof deviceName === 'string'
        ? deviceName.trim().slice(0, 100) || 'Security Key'
        : 'Security Key'

      await sql.begin(async sql => {
        await sql`
          insert into webauthn_credentials ${sql({
            admin_id: admin.id,
            credential_id: credentialId,
            public_key: isoBase64URL.fromBuffer(credentialData.publicKey),
            counter: BigInt(credentialData.counter ?? 0),
            device_name: sanitizedDeviceName,
            transports: credential.response?.transports || []
          })}
        `

        await sql`
          update admins
          set current_challenge = null,
              challenge_expires_at = null
          where id = ${admin.id}
        `
      })

      return {
        verified: true,
        message: 'Security key registered successfully'
      }
    } catch (error) {
      fastify.log.error(error)
      reply.code(400)
      return {
        error: 'Registration verification failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }
  })

  // Step 3: Generate authentication options (login challenge)
  fastify.post('/authenticate/options', { schema: authenticateOptionsSchema }, async (request, reply) => {
    try {
      fastify.log.info('Authentication options request received')

      const emailValidation = validateEmail(request.body.email)
      if (!emailValidation.valid) {
        fastify.log.warn({ error: emailValidation.error }, 'Authentication options: Invalid email')
        reply.code(400)
        return { error: emailValidation.error }
      }

      const email = emailValidation.email
      fastify.log.info({ email }, 'Looking up admin for authentication')

      const admin = await loadAdminByEmail(sql, email)

      if (!admin) {
        fastify.log.warn({ email }, 'Admin not found')
        reply.code(404)
        return { error: 'Admin not found' }
      }

      if (!admin.isActive) {
        fastify.log.warn({ email, adminId: admin.id }, 'Account is inactive')
        reply.code(403)
        return { error: 'Account is inactive' }
      }

      if (admin.webauthnCredentials.length === 0) {
        fastify.log.warn({ email, adminId: admin.id }, 'No security keys registered')
        reply.code(400)
        return { error: 'No security keys registered. Please register a key first.' }
      }

      const validCredentials = admin.webauthnCredentials.filter(
        cred => cred.credentialId && typeof cred.credentialId === 'string' && cred.credentialId.length > 0
      )

      fastify.log.info({
        adminId: admin.id,
        credentialCount: validCredentials.length,
        rpID: RP_ID
      }, 'Generating authentication options')

      const authOptions = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: validCredentials.map(cred => ({
          id: cred.credentialId,
          type: 'public-key',
          transports: Array.isArray(cred.transports) ? cred.transports : []
        })),
        userVerification: 'preferred'
      })

      fastify.log.info({ challengeLength: authOptions.challenge.length }, 'Storing authentication challenge')

      const challengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000)
      await sql`
        update admins
        set current_challenge = ${authOptions.challenge},
            challenge_expires_at = ${challengeExpiresAt}
        where id = ${admin.id}
      `

      fastify.log.info('Authentication options generated successfully')
      return authOptions
    } catch (error) {
      fastify.log.error({
        error: error.message,
        stack: error.stack,
        name: error.name
      }, 'Error generating authentication options')
      reply.code(500)
      return {
        error: 'Failed to generate authentication options',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }
  })

  // Step 4: Verify authentication response and log in
  fastify.post('/authenticate/verify', { schema: authenticateVerifySchema }, async (request, reply) => {
    try {
      const emailValidation = validateEmail(request.body.email)
      if (!emailValidation.valid) {
        reply.code(400)
        return { error: emailValidation.error }
      }

      const email = emailValidation.email
      const { credential } = request.body

      if (!credential || typeof credential !== 'object') {
        reply.code(400)
        return { error: 'Valid credential object is required' }
      }

      const admin = await loadAdminByEmail(sql, email)

      if (!admin || !admin.currentChallenge) {
        reply.code(400)
        return { error: 'Invalid authentication session' }
      }

      if (!isValidChallenge(admin)) {
        reply.code(400)
        return { error: 'Authentication challenge has expired. Please try again.' }
      }

      const credentialId = credential.id
      const dbCredential = admin.webauthnCredentials.find(
        cred => cred.credentialId === credentialId
      )

      if (!dbCredential) {
        fastify.log.error({
          credentialId,
          availableCredentials: admin.webauthnCredentials.map(c => c.credentialId)
        }, 'Credential not found in database')
        reply.code(400)
        return { error: 'Credential not found' }
      }

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: admin.currentChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: dbCredential.credentialId,
          publicKey: isoBase64URL.toBuffer(dbCredential.publicKey),
          counter: Number(dbCredential.counter),
          transports: dbCredential.transports
        }
      })

      if (!verification.verified) {
        reply.code(401)
        return { error: 'Authentication failed' }
      }

      const newCounter = verification.authenticationInfo.newCounter != null
        ? BigInt(verification.authenticationInfo.newCounter)
        : dbCredential.counter

      // FIDO2 §6.4 counter replay protection: a cloned authenticator would
      // reuse a counter value the server has already seen. Skip the check
      // when dbCredential.counter === 0n because software authenticators
      // (Touch ID, Windows Hello) legitimately report 0 on every assertion.
      if (dbCredential.counter > 0n && newCounter <= dbCredential.counter) {
        reply.code(409)
        return { error: 'Authentication failed: counter replay detected' }
      }

      await sql.begin(async sql => {
        await sql`
          update webauthn_credentials
          set counter = ${newCounter},
              last_used_at = ${new Date()}
          where id = ${dbCredential.id}
        `

        await sql`
          update admins
          set last_login_at = ${new Date()},
              current_challenge = null,
              challenge_expires_at = null
          where id = ${admin.id}
        `
      })

      request.session.adminId = admin.id

      return {
        verified: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      }
    } catch (error) {
      fastify.log.error(error)
      reply.code(401)
      return {
        error: 'Authentication failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }
  })

  // List registered credentials for current admin
  fastify.get('/credentials', async (request, reply) => {
    if (!request.session?.adminId) {
      reply.code(401)
      return { error: 'Not authenticated' }
    }

    const credentials = await sql`
      select id, device_name, transports, last_used_at, created_at
      from webauthn_credentials
      where admin_id = ${request.session.adminId}
      order by created_at desc
    `

    return { credentials }
  })

  // Delete a credential — requires both a valid session and a CSRF token
  async function requireSessionThenCsrf(request, reply) {
    if (!request.session?.adminId) {
      reply.code(401)
      return reply.send({ error: 'Not authenticated' })
    }
    return csrfProtection(request, reply)
  }

  fastify.delete('/credentials/:id', { preHandler: requireSessionThenCsrf }, async (request, reply) => {
    const { id } = request.params

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      reply.code(400)
      return { error: 'Valid credential ID is required' }
    }

    const trimmedId = id.trim()

    if (!UUID_RE.test(trimmedId)) {
      reply.code(404)
      return { error: 'Credential not found' }
    }

    let notFound = false
    let isLastKey = false

    // Early returns inside sql.begin() commit the transaction with no writes — they do NOT
    // exit the outer function. The outer flags (notFound, isLastKey) are read after await
    // to branch the HTTP response. Any write added after an early `return` here would be
    // committed, so keep this callback write-free on the early-exit paths.
    await sql.begin(async sql => {
      const [credential] = await sql`
        select id from webauthn_credentials
        where id = ${trimmedId} and admin_id = ${request.session.adminId}
        for update
      `

      if (!credential) {
        notFound = true
        return
      }

      const [{ count }] = await sql`
        select count(*)::int as count
        from webauthn_credentials
        where admin_id = ${request.session.adminId}
      `

      if (Number(count) <= 1) {
        isLastKey = true
        return
      }

      await sql`delete from webauthn_credentials where id = ${trimmedId}`
    })

    if (notFound) {
      reply.code(404)
      return { error: 'Credential not found' }
    }

    if (isLastKey) {
      reply.code(400)
      return { error: 'Cannot delete your last security key' }
    }

    return { success: true }
  })
}
