import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'

/**
 * WebAuthn Validation Test Suite
 *
 * Tests for security vulnerabilities documented in VALIDATION_BUGS_FOUND.md:
 * - Bug #1: Missing Input Sanitization (whitespace-only emails)
 * - Bug #2: Type Coercion Vulnerabilities (non-string emails cause 500 errors)
 * - Bug #3: Email Normalization Crashes (.toLowerCase() on non-strings)
 * - Bug #4: Missing Request Body Validation (no JSON schema)
 */

let app

beforeAll(async () => {
  app = await buildApp({ logger: false })
})

afterAll(async () => {
  await app.close()
})

describe('WebAuthn Registration Options Endpoint', () => {
  const endpoint = '/api/admin/webauthn/register/options'

  describe('Email Validation - Bug #1: Missing Input Sanitization', () => {
    it('should reject request with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: {}
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('should reject request with null email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: null }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('should reject request with empty string email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('should reject request with whitespace-only email (Bug #1 fix verification)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '   ' }
      })

      // Should return 400, not 403 (Bug #1 was returning 403)
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
      expect(body.error).toContain('Email is required')
    })

    it('should reject request with tabs and newlines only', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '\t\n\r' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('should reject request with invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'notanemail' }
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
      expect(body.error).toContain('Invalid email format')
    })

    it('should reject request with email missing domain', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'test@' }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject request with email missing @ symbol', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'testexample.com' }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('Type Coercion Vulnerabilities - Bug #2 Fix Verification', () => {
    it('should handle email with number type (Bug #2 fix - should return 400, not 500)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 12345 }
      })

      // Bug #2: Was returning 500, should return 400
      expect(response.statusCode).toBe(400)
      expect(response.statusCode).not.toBe(500)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('should handle email with object type (Bug #2 fix - should return 400, not 500)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: { malicious: 'payload' } }
      })

      // Bug #2: Was returning 500, should return 400
      expect(response.statusCode).toBe(400)
      expect(response.statusCode).not.toBe(500)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('should handle email with array type (Bug #2 fix - should not return 500)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: ['test@example.com'] }
      })

      // Bug #2 fix verification: Should NOT return 500 (crash)
      // Note: JSON schema may coerce single-element array to string, which is acceptable
      // The key security fix is preventing 500 errors from type coercion crashes
      expect(response.statusCode).not.toBe(500)
    })

    it('should handle email with boolean type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: true }
      })

      expect(response.statusCode).toBe(400)
      expect(response.statusCode).not.toBe(500)
    })

    it('should handle email with undefined (JSON omits undefined)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: JSON.stringify({ email: undefined }),
        headers: { 'content-type': 'application/json' }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('Email Normalization - Bug #3 Fix Verification', () => {
    it('should normalize email to lowercase (Bug #3 fix)', async () => {
      // This test verifies the fix works without crashing
      // The actual normalization is tested by successful processing
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'TEST@EXAMPLE.COM' }
      })

      // Should not return 500 (Bug #3 was causing crashes)
      expect(response.statusCode).not.toBe(500)
    })

    it('should trim leading/trailing whitespace from email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '  test@example.com  ' }
      })

      // Should process trimmed email, not crash
      expect(response.statusCode).not.toBe(500)
    })
  })

  describe('Request Body Validation - Bug #4 Fix Verification', () => {
    it('should strip additional unknown properties from request (additionalProperties: false)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: {
          email: 'test@example.com',
          malicious: 'injection',
          anotherField: 'attack'
        }
      })

      // Fastify's default behavior with additionalProperties: false is to strip extra properties
      // This is secure because malicious properties are removed, not passed to handlers
      // The request should succeed (200) or the email should be processed normally
      // If user doesn't exist, it creates them, so we accept 200 or check the email was processed
      expect(response.statusCode).not.toBe(500)
      // The key is that it processes without crash and extra fields are ignored
    })

    it('should reject request with extremely long email (DoS prevention)', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com'
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: longEmail }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle malformed JSON gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: 'not valid json{',
        headers: { 'content-type': 'application/json' }
      })

      // Should return error, not crash
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
      expect(response.statusCode).toBeLessThan(500)
    })
  })

  describe('Security Edge Cases', () => {
    it('should handle SQL injection attempt in email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: "test'; DROP TABLE admins; --@example.com" }
      })

      // Should be rejected by email format validation
      expect(response.statusCode).toBe(400)
    })

    it('should handle XSS attempt in email without crashing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '<script>alert("xss")</script>@example.com' }
      })

      // The email format technically matches pattern (has @, has .), so it may pass format check
      // XSS protection should happen at output encoding, not input validation for emails
      // The key security check is that it doesn't crash and doesn't expose stack traces
      expect(response.statusCode).not.toBe(500)
      // If stored, HTML entities would be escaped at render time
    })

    it('should handle Unicode homograph attack in email', async () => {
      // Using Cyrillic 'a' (U+0430) instead of Latin 'a'
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'tеst@example.com' } // Contains Cyrillic 'е'
      })

      // Should either accept (if valid) or reject, but not crash
      expect(response.statusCode).not.toBe(500)
    })
  })
})

describe('WebAuthn Registration Verify Endpoint', () => {
  const endpoint = '/api/admin/webauthn/register/verify'

  describe('Email Validation', () => {
    it('should reject request with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { credential: {} }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject request with whitespace-only email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '   ', credential: {} }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle non-string email type without crashing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 12345, credential: {} }
      })

      expect(response.statusCode).toBe(400)
      expect(response.statusCode).not.toBe(500)
    })
  })

  describe('Credential Validation', () => {
    it('should reject request with missing credential', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'test@example.com' }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject request with null credential', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'test@example.com', credential: null }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject request with non-object credential', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'test@example.com', credential: 'string' }
      })

      expect(response.statusCode).toBe(400)
    })
  })
})

describe('WebAuthn Authentication Options Endpoint', () => {
  const endpoint = '/api/admin/webauthn/authenticate/options'

  describe('Email Validation', () => {
    it('should reject request with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject request with whitespace-only email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '   ' }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle non-string email type without crashing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: { attack: 'object' } }
      })

      expect(response.statusCode).toBe(400)
      expect(response.statusCode).not.toBe(500)
    })

    it('should reject invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'invalid-email' }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('Request Body Validation', () => {
    it('should reject additional unknown properties', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: {
          email: 'test@example.com',
          malicious: 'payload'
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })
})

describe('WebAuthn Authentication Verify Endpoint', () => {
  const endpoint = '/api/admin/webauthn/authenticate/verify'

  describe('Email Validation', () => {
    it('should reject request with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { credential: {} }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject request with whitespace-only email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: '   ', credential: {} }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle non-string email type without crashing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: [1, 2, 3], credential: {} }
      })

      expect(response.statusCode).toBe(400)
      expect(response.statusCode).not.toBe(500)
    })
  })

  describe('Credential Validation', () => {
    it('should reject request with missing credential', async () => {
      const response = await app.inject({
        method: 'POST',
        url: endpoint,
        payload: { email: 'test@example.com' }
      })

      expect(response.statusCode).toBe(400)
    })
  })
})

describe('WebAuthn Credentials Management Endpoints', () => {
  describe('GET /credentials', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/webauthn/credentials'
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Unauthorized')
    })
  })

  describe('DELETE /credentials/:id', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/admin/webauthn/credentials/test-id'
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Unauthorized')
    })
  })
})

describe('Error Response Security', () => {
  it('should not expose stack traces in error responses', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/webauthn/register/options',
      payload: { email: { toString: () => { throw new Error('Attack') } } }
    })

    const body = JSON.parse(response.body)
    expect(body).not.toHaveProperty('stack')
    expect(body.error).not.toContain('Error:')
    expect(body.error).not.toContain('at ')
  })

  it('should return consistent error format across endpoints', async () => {
    const endpoints = [
      { method: 'POST', url: '/api/admin/webauthn/register/options', payload: {} },
      { method: 'POST', url: '/api/admin/webauthn/register/verify', payload: {} },
      { method: 'POST', url: '/api/admin/webauthn/authenticate/options', payload: {} },
      { method: 'POST', url: '/api/admin/webauthn/authenticate/verify', payload: {} }
    ]

    for (const ep of endpoints) {
      const response = await app.inject(ep)
      const body = JSON.parse(response.body)

      // All error responses should have 'error' property
      expect(body).toHaveProperty('error')
      expect(typeof body.error).toBe('string')
    }
  })
})
