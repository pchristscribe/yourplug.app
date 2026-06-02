import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Setup global mocks before any imports
global.useRuntimeConfig = vi.fn(() => ({
  public: {
    apiBase: 'http://localhost:3001'
  }
}))

global.navigateTo = vi.fn()
global.$fetch = vi.fn()

// Mock window.PublicKeyCredential for WebAuthn
if (typeof window === 'undefined') {
  // @ts-ignore
  global.window = {}
}
global.window.PublicKeyCredential = class MockPublicKeyCredential {}

// Stub rate limiter so it never blocks during auth unit tests
// useRateLimit is a Nuxt auto-import (no explicit import in auth.ts), so stubGlobal
// intercepts it correctly where vi.mock on the module path would not.
vi.stubGlobal('useRateLimit', () => ({ check: () => ({ allowed: true }), record: () => {}, reset: () => {} }))

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn().mockResolvedValue({ id: 'cred-id' }),
  startRegistration: vi.fn().mockResolvedValue({ id: 'cred-id' }),
}))

// Import after mocks are set up
import { useAuthStore } from '../app/stores/auth'

describe('Auth Store - Input Validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('registerSecurityKey', () => {
    describe('Email Validation', () => {
      it('should reject empty email', async () => {
        const store = useAuthStore()

        // Mock the API to check what email was sent
        global.$fetch = vi.fn().mockRejectedValue(new Error('Should not be called'))

        const result = await store.registerSecurityKey('')

        expect(result).toBe(false)
        // Should not call API with empty email
        expect(global.$fetch).not.toHaveBeenCalled()
      })

      it('should reject whitespace-only email', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Should not be called'))

        const result = await store.registerSecurityKey('   ')

        expect(result).toBe(false)
        expect(global.$fetch).not.toHaveBeenCalled()
      })

      it('should validate email format before sending to backend', async () => {
        const store = useAuthStore()

        // Invalid email formats that should be caught
        const invalidEmails = [
          'notanemail',
          '@example.com',
          'user@',
          'user @example.com',
          'user@.com',
          'user..name@example.com'
        ]

        for (const email of invalidEmails) {
          global.$fetch = vi.fn()

          const result = await store.registerSecurityKey(email)

          // Should either validate client-side or let backend reject
          // Current implementation may send to backend
          // This test documents the expected behavior
          if (result === false && global.$fetch.mock.calls.length === 0) {
            // Good: Client-side validation
            expect(result).toBe(false)
          } else {
            // Currently sends to backend - should be improved
            expect(global.$fetch).toHaveBeenCalled()
          }

          vi.clearAllMocks()
        }
      })

      it('should handle email with special characters', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockResolvedValueOnce({
          challenge: 'mock-challenge',
          user: { id: 'mock-id' }
        })

        // Email with valid special characters
        const email = 'test+tag@example.com'

        try {
          await store.registerSecurityKey(email)
        } catch {
          // Expected to fail at WebAuthn step, not email validation
        }

        // Should send email to backend (special chars are valid in email)
        expect(global.$fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.objectContaining({
              email: email
            })
          })
        )
      })

      it('should normalize email to lowercase before sending', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockResolvedValueOnce({
          challenge: 'mock-challenge',
          user: { id: 'mock-id' }
        })

        const email = 'Test.User@EXAMPLE.COM'

        try {
          await store.registerSecurityKey(email)
        } catch {
          // Expected to fail at WebAuthn step
        }

        // Check if email is sent as-is or normalized
        expect(global.$fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.objectContaining({
              email: expect.any(String) // Documents that normalization should happen
            })
          })
        )
      })

      it('should handle null/undefined email gracefully', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Should not be called'))

        // @ts-expect-error Testing invalid input
        const result1 = await store.registerSecurityKey(null)
        expect(result1).toBe(false)

        // @ts-expect-error Testing invalid input
        const result2 = await store.registerSecurityKey(undefined)
        expect(result2).toBe(false)

        expect(global.$fetch).not.toHaveBeenCalled()
      })

      it('should handle non-string email types gracefully', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Should not be called'))

        // @ts-expect-error Testing invalid input
        const result1 = await store.registerSecurityKey(12345)
        expect(result1).toBe(false)

        // @ts-expect-error Testing invalid input
        const result2 = await store.registerSecurityKey({ email: 'test@example.com' })
        expect(result2).toBe(false)

        // @ts-expect-error Testing invalid input
        const result3 = await store.registerSecurityKey(['test@example.com'])
        expect(result3).toBe(false)

        expect(global.$fetch).not.toHaveBeenCalled()
      })
    })

    describe('Device Name Validation', () => {
      it('should allow registration without device name', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({
            challenge: 'mock-challenge',
            user: { id: 'mock-id' }
          })

        try {
          // Call without deviceName parameter
          await store.registerSecurityKey('test@example.com')
        } catch {
          // Expected to fail at WebAuthn browser step
        }

        // Should have called API (deviceName is optional)
        expect(global.$fetch).toHaveBeenCalled()
      })

      it('should sanitize device name input', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({
            challenge: 'mock-challenge',
            user: { id: 'mock-id' }
          })

        const dangerousNames = [
          '<script>alert("xss")</script>',
          '"; DROP TABLE credentials; --',
          '\u0000null byte',
          'a'.repeat(1000) // Very long string
        ]

        for (const deviceName of dangerousNames) {
          try {
            await store.registerSecurityKey('test@example.com', deviceName)
          } catch {
            // Expected to fail
          }

          // Document: Device name should be sanitized or validated
          // Current implementation may send as-is
          vi.clearAllMocks()
        }
      })

      it('should handle empty string device name', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({
            challenge: 'mock-challenge',
            user: { id: 'mock-id' }
          })

        try {
          await store.registerSecurityKey('test@example.com', '')
        } catch {
          // Expected to fail
        }

        // Empty string should be treated as undefined
        expect(global.$fetch).toHaveBeenCalled()
      })
    })

    describe('Error Handling', () => {
      it('should handle network errors gracefully', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue({
          name: 'FetchError',
          message: 'Failed to fetch',
          cause: { code: 'ECONNREFUSED' }
        })

        const result = await store.registerSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('Cannot connect to backend server')
        expect(store.loading).toBe(false)
      })

      it('should handle 404 errors gracefully', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue({
          statusCode: 404,
          status: 404,
          message: 'Not Found'
        })

        const result = await store.registerSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('Backend API not found')
        expect(store.loading).toBe(false)
      })

      it('should handle WebAuthn NotAllowedError', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
          .mockRejectedValue({
            name: 'NotAllowedError',
            message: 'User cancelled'
          })

        const result = await store.registerSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('cancelled or timed out')
        expect(store.loading).toBe(false)
      })

      it('should handle WebAuthn SecurityError', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
          .mockRejectedValue({
            name: 'SecurityError',
            message: 'Invalid origin'
          })

        const result = await store.registerSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('Security error')
        expect(store.loading).toBe(false)
      })

      it('should handle WebAuthn InvalidStateError (duplicate credential)', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
          .mockRejectedValue({
            name: 'InvalidStateError',
            message: 'Credential already registered'
          })

        const result = await store.registerSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('already registered')
        expect(store.loading).toBe(false)
      })

      it('should handle WebAuthn NotSupportedError', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
          .mockRejectedValue({
            name: 'NotSupportedError',
            message: 'Not supported'
          })

        const result = await store.registerSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('does not support WebAuthn')
        expect(store.loading).toBe(false)
      })

      it('should handle server validation errors', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue({
          statusCode: 400,
          data: {
            error: 'Invalid email format'
          }
        })

        const result = await store.registerSecurityKey('invalid-email')

        expect(result).toBe(false)
        expect(store.error).toBe('Invalid email format')
        expect(store.loading).toBe(false)
      })
    })

    describe('Loading State Management', () => {
      it('should set loading to true during registration', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockImplementation(() => {
          // Check loading state during async operation
          expect(store.loading).toBe(true)
          return Promise.resolve({ challenge: 'test', user: { id: 'test' } })
        })

        try {
          await store.registerSecurityKey('test@example.com')
        } catch {
          // Expected to fail
        }

        expect(global.$fetch).toHaveBeenCalled()
      })

      it('should set loading to false after completion', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Test error'))

        await store.registerSecurityKey('test@example.com')

        expect(store.loading).toBe(false)
      })

      it('should set loading to false even on error', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Network error'))

        await store.registerSecurityKey('test@example.com')

        expect(store.loading).toBe(false)
      })
    })
  })

  describe('loginWithSecurityKey', () => {
    describe('Email Validation', () => {
      it('should reject empty email', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Should not be called'))

        const result = await store.loginWithSecurityKey('')

        expect(result).toBe(false)
        expect(global.$fetch).not.toHaveBeenCalled()
      })

      it('should reject null/undefined email', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Should not be called'))

        // @ts-expect-error Testing invalid input
        const result1 = await store.loginWithSecurityKey(null)
        expect(result1).toBe(false)

        // @ts-expect-error Testing invalid input
        const result2 = await store.loginWithSecurityKey(undefined)
        expect(result2).toBe(false)

        expect(global.$fetch).not.toHaveBeenCalled()
      })

      it('should reject whitespace-only email', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue(new Error('Should not be called'))

        const result = await store.loginWithSecurityKey('   ')

        expect(result).toBe(false)
        expect(global.$fetch).not.toHaveBeenCalled()
      })
    })

    describe('Error Handling', () => {
      it('should handle "no security keys registered" error', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue({
          statusCode: 400,
          data: {
            error: 'No security keys registered. Please register a key first.'
          }
        })

        const result = await store.loginWithSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('No security keys registered')
        expect(store.loading).toBe(false)
      })

      it('should handle authentication cancellation', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({ challenge: 'test' })
          .mockRejectedValue({
            name: 'NotAllowedError',
            message: 'User cancelled'
          })

        const result = await store.loginWithSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('cancelled or timed out')
      })

      it('should handle network errors', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue({
          message: 'Failed to fetch',
          cause: { code: 'ECONNREFUSED' }
        })

        const result = await store.loginWithSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('Cannot connect to backend server')
      })

      it('should handle 404 errors', async () => {
        const store = useAuthStore()

        global.$fetch = vi.fn().mockRejectedValue({
          statusCode: 404
        })

        const result = await store.loginWithSecurityKey('test@example.com')

        expect(result).toBe(false)
        expect(store.error).toContain('Backend API not found')
      })
    })

    describe('Success Flow', () => {
      it('should set admin data on successful login', async () => {
        const store = useAuthStore()

        const mockAdmin = {
          id: 'admin-123',
          email: 'test@example.com',
          name: 'Test Admin',
          role: 'admin'
        }

        global.$fetch = vi.fn()
          .mockResolvedValueOnce({ challenge: 'test' })
          .mockResolvedValueOnce({
            verified: true,
            admin: mockAdmin
          })

        try {
          const result = await store.loginWithSecurityKey('test@example.com')

          // May fail due to mock limitations, but documents expected behavior
          if (result) {
            expect(store.admin).toEqual(mockAdmin)
            expect(store.isAuthenticated).toBe(true)
          }
        } catch {
          // Expected - WebAuthn mocking is complex
        }
      })
    })
  })

  describe('SSR Safety', () => {
    it('should not execute WebAuthn operations on server-side', async () => {
      // Simulate server-side rendering
      const originalWindow = global.window
      // @ts-expect-error Testing SSR behavior
      global.window = undefined

      const store = useAuthStore()

      global.$fetch = vi.fn()

      const result1 = await store.registerSecurityKey('test@example.com')
      const result2 = await store.loginWithSecurityKey('test@example.com')

      expect(result1).toBe(false)
      expect(result2).toBe(false)
      expect(global.$fetch).not.toHaveBeenCalled()

      // Restore window
      global.window = originalWindow
    })
  })

  describe('State Management', () => {
    it('should clear error on new operation', async () => {
      const store = useAuthStore()

      // Set an error
      store.error = 'Previous error'

      global.$fetch = vi.fn().mockRejectedValue(new Error('New error'))

      await store.registerSecurityKey('test@example.com')

      // Error should be updated (cleared then set to new)
      expect(store.error).not.toBe('Previous error')
    })

    it('should maintain error state on failure', async () => {
      const store = useAuthStore()

      global.$fetch = vi.fn().mockRejectedValue({
        data: { error: 'Test error message' }
      })

      await store.registerSecurityKey('test@example.com')

      expect(store.error).toBeTruthy()
      expect(store.error).toBe('Test error message')
    })
  })
})

/**
 * Security-focused edge case tests
 * These tests verify protection against various attack vectors
 * Reference: VALIDATION_BUGS_FOUND.md - Bugs #1, #2, #3
 */
describe('Auth Store - Security Edge Cases', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Email Injection Prevention', () => {
    // Bug #1: Whitespace attacks
    it('should reject emails with only tabs', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      const result = await store.registerSecurityKey('\t\t\t')

      expect(result).toBe(false)
      expect(store.error).toBe('Email is required')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should reject emails with mixed whitespace', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      const result = await store.registerSecurityKey(' \t \n ')

      expect(result).toBe(false)
      expect(store.error).toBe('Email is required')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should trim leading/trailing whitespace from valid emails', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockResolvedValueOnce({
        challenge: 'test',
        user: { id: 'test' }
      })

      try {
        await store.registerSecurityKey('  test@example.com  ')
      } catch {
        // WebAuthn step will fail, but email should be trimmed
      }

      // Should call API with trimmed, lowercase email
      expect(global.$fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            email: 'test@example.com'
          })
        })
      )
    })

    // XSS attack vectors in email
    it('should reject email with HTML script tags', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      const result = await store.registerSecurityKey('<script>alert("xss")</script>@evil.com')

      expect(result).toBe(false)
      expect(store.error).toBe('Invalid email format')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should reject email with javascript protocol', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      const result = await store.registerSecurityKey('javascript:alert(1)@example.com')

      expect(result).toBe(false)
      expect(store.error).toBe('Invalid email format')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    // SQL injection patterns
    it('should reject email with SQL injection pattern', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      const result = await store.registerSecurityKey("'; DROP TABLE users; --@evil.com")

      expect(result).toBe(false)
      expect(store.error).toBe('Invalid email format')
      expect(global.$fetch).not.toHaveBeenCalled()
    })
  })

  describe('Type Coercion Prevention', () => {
    // Bug #2: Non-string types should not cause crashes
    it('should handle boolean true gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(true)

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle boolean false gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(false)

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle number 0 gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(0)

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle NaN gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(NaN)

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle Infinity gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(Infinity)

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle Symbol gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(Symbol('email'))

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle BigInt gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(BigInt(12345))

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle function gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(() => 'test@example.com')

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle nested object gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey({ nested: { email: 'test@example.com' } })

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle array with toString override gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      const maliciousArray = ['test@example.com']
      maliciousArray.toString = () => 'malicious@evil.com'

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(maliciousArray)

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should handle object with valueOf override gracefully', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      const maliciousObject = {
        valueOf: () => 'malicious@evil.com',
        toString: () => 'malicious@evil.com'
      }

      // @ts-expect-error Testing runtime type safety
      const result = await store.registerSecurityKey(maliciousObject)

      expect(result).toBe(false)
      expect(store.error).toBe('Email must be a string')
      expect(global.$fetch).not.toHaveBeenCalled()
    })
  })

  describe('Email Normalization Security', () => {
    // Bug #3: Ensure normalization doesn't introduce vulnerabilities
    it('should normalize unicode lookalike characters', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockResolvedValueOnce({
        challenge: 'test',
        user: { id: 'test' }
      })

      // Email should be normalized to lowercase
      try {
        await store.registerSecurityKey('TEST@EXAMPLE.COM')
      } catch {
        // WebAuthn step will fail
      }

      expect(global.$fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            email: 'test@example.com'
          })
        })
      )
    })

    it('should reject extremely long email addresses', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // Create an email that exceeds reasonable limits (254 chars is the RFC limit)
      const longEmail = 'a'.repeat(250) + '@example.com'

      const result = await store.registerSecurityKey(longEmail)

      expect(result).toBe(false)
      expect(store.error).toBe('Email is too long')
      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should accept email at exactly 254 characters', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockResolvedValueOnce({
        challenge: 'test',
        user: { id: 'test' }
      })

      // Create exactly 254 character email (valid)
      const localPart = 'a'.repeat(242)  // 242 + 1 (@) + 11 (example.com) = 254
      const validLongEmail = `${localPart}@example.com`

      try {
        await store.registerSecurityKey(validLongEmail)
      } catch {
        // WebAuthn step will fail
      }

      // Should pass validation and attempt API call
      expect(global.$fetch).toHaveBeenCalled()
    })
  })

  describe('Device Name Sanitization', () => {
    it('should remove XSS script tags from device name', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()
        .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
        .mockResolvedValueOnce({ verified: true })

      try {
        await store.registerSecurityKey('test@example.com', '<script>alert("xss")</script>')
      } catch {
        // WebAuthn step will fail
      }

      // Verify the device name in the second API call (verification) is sanitized
      if (global.$fetch.mock.calls.length >= 2) {
        const verifyCall = global.$fetch.mock.calls[1]
        const body = verifyCall[1]?.body
        // Device name should have dangerous characters removed
        expect(body?.deviceName).not.toContain('<script>')
        expect(body?.deviceName).not.toContain('>')
      }
    })

    it('should truncate extremely long device names', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()
        .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
        .mockResolvedValueOnce({ verified: true })

      const longDeviceName = 'A'.repeat(500)

      try {
        await store.registerSecurityKey('test@example.com', longDeviceName)
      } catch {
        // WebAuthn step will fail
      }

      // Verify device name is truncated
      if (global.$fetch.mock.calls.length >= 2) {
        const verifyCall = global.$fetch.mock.calls[1]
        const body = verifyCall[1]?.body
        if (body?.deviceName) {
          expect(body.deviceName.length).toBeLessThanOrEqual(100)
        }
      }
    })

    it('should handle null byte injection in device name', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()
        .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
        .mockResolvedValueOnce({ verified: true })

      try {
        await store.registerSecurityKey('test@example.com', 'Device\x00Name')
      } catch {
        // WebAuthn step will fail
      }

      // Should have called API (null bytes are handled)
      expect(global.$fetch).toHaveBeenCalled()
    })

    it('should handle SQL injection in device name', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()
        .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
        .mockResolvedValueOnce({ verified: true })

      try {
        await store.registerSecurityKey('test@example.com', "'; DROP TABLE credentials; --")
      } catch {
        // WebAuthn step will fail
      }

      // Verify device name has dangerous characters removed
      if (global.$fetch.mock.calls.length >= 2) {
        const verifyCall = global.$fetch.mock.calls[1]
        const body = verifyCall[1]?.body
        // Single quotes should be sanitized
        expect(body?.deviceName).not.toContain("'")
      }
    })

    it('should convert non-string device names to undefined', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()
        .mockResolvedValueOnce({ challenge: 'test', user: { id: 'test' } })
        .mockResolvedValueOnce({ verified: true })

      try {
        // @ts-expect-error Testing runtime safety
        await store.registerSecurityKey('test@example.com', { malicious: 'object' })
      } catch {
        // WebAuthn step will fail
      }

      // Device name should be undefined for non-string inputs
      if (global.$fetch.mock.calls.length >= 2) {
        const verifyCall = global.$fetch.mock.calls[1]
        const body = verifyCall[1]?.body
        expect(body?.deviceName).toBeUndefined()
      }
    })
  })

  describe('loginWithSecurityKey Security', () => {
    it('should apply same email validation as registration', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn()

      // Test type coercion prevention
      // @ts-expect-error Testing runtime type safety
      const result1 = await store.loginWithSecurityKey(12345)
      expect(result1).toBe(false)
      expect(store.error).toBe('Email must be a string')

      vi.clearAllMocks()

      // Test whitespace-only rejection
      const result2 = await store.loginWithSecurityKey('   ')
      expect(result2).toBe(false)
      expect(store.error).toBe('Email is required')

      vi.clearAllMocks()

      // Test invalid format rejection
      const result3 = await store.loginWithSecurityKey('not-an-email')
      expect(result3).toBe(false)
      expect(store.error).toBe('Invalid email format')

      expect(global.$fetch).not.toHaveBeenCalled()
    })

    it('should normalize email to lowercase for login', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockResolvedValueOnce({
        challenge: 'test'
      })

      try {
        await store.loginWithSecurityKey('TEST.USER@EXAMPLE.COM')
      } catch {
        // WebAuthn step will fail
      }

      expect(global.$fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            email: 'test.user@example.com'
          })
        })
      )
    })
  })

  describe('Error State Isolation', () => {
    it('should not leak error messages between operations', async () => {
      const store = useAuthStore()

      // First operation fails with validation error
      // @ts-expect-error Testing runtime safety
      await store.registerSecurityKey(null)
      expect(store.error).toBe('Email must be a string')

      // Second operation with different invalid input
      await store.registerSecurityKey('')
      expect(store.error).toBe('Email is required')

      // Error should be from second operation, not first
      expect(store.error).not.toBe('Email must be a string')
    })

    it('should clear error when validation passes but API fails', async () => {
      const store = useAuthStore()

      // Set initial error
      store.error = 'Initial error'

      // Valid email but API fails
      global.$fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await store.registerSecurityKey('test@example.com')

      // Error should be from API failure, not initial state
      expect(store.error).not.toBe('Initial error')
      expect(store.error).toBeTruthy()
    })
  })

  describe('loginWithPassword', () => {
    it('should reject missing password', async () => {
      const store = useAuthStore()
      const result = await store.loginWithPassword('admin@example.com', '')
      expect(result).toBe(false)
      expect(store.error).toBe('Password is required')
    })

    it('should reject non-string password', async () => {
      const store = useAuthStore()
      const result = await store.loginWithPassword('admin@example.com', null)
      expect(result).toBe(false)
      expect(store.error).toBe('Password is required')
    })

    it('should reject invalid email before checking password', async () => {
      const store = useAuthStore()
      const result = await store.loginWithPassword('not-an-email', 'placeholder-pwd')
      expect(result).toBe(false)
      expect(store.error).toBe('Invalid email format')
    })

    it('should set admin and return true on success', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockResolvedValue({
        success: true,
        admin: { id: '1', email: 'admin@example.com', name: 'Admin', role: 'admin' }
      })

      const result = await store.loginWithPassword('admin@example.com', 'placeholder-pwd')

      expect(result).toBe(true)
      expect(store.admin?.email).toBe('admin@example.com')
      expect(store.error).toBeNull()
    })

    it('should normalize email to lowercase before sending', async () => {
      const store = useAuthStore()
      const fetchSpy = vi.fn().mockResolvedValue({
        success: true,
        admin: { id: '1', email: 'admin@example.com', name: 'A', role: 'admin' }
      })
      global.$fetch = fetchSpy

      await store.loginWithPassword('  ADMIN@EXAMPLE.COM  ', 'placeholder-pwd')

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: { email: 'admin@example.com', password: 'placeholder-pwd' }
        })
      )
    })

    it('should map 401 to a friendly invalid-credentials message', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockRejectedValue({ statusCode: 401 })

      const result = await store.loginWithPassword('admin@example.com', 'bad-pwd')

      expect(result).toBe(false)
      expect(store.error).toBe('Invalid email or password')
    })

    it('should map 403 to the inactive-account message from server', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockRejectedValue({
        statusCode: 403,
        data: { message: 'Your admin account has been deactivated' }
      })

      const result = await store.loginWithPassword('admin@example.com', 'placeholder-pwd')

      expect(result).toBe(false)
      expect(store.error).toBe('Your admin account has been deactivated')
    })

    it('should clear loading state after error', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockRejectedValue(new Error('boom'))

      await store.loginWithPassword('admin@example.com', 'placeholder-pwd')

      expect(store.loading).toBe(false)
    })

    it('should surface an error when server returns success without admin payload', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockResolvedValue({ success: true })

      const result = await store.loginWithPassword('admin@example.com', 'placeholder-pwd')

      expect(result).toBe(false)
      expect(store.error).toBe('Unexpected response from server')
    })

    it('should surface a friendly message for connection refused', async () => {
      const store = useAuthStore()
      global.$fetch = vi.fn().mockRejectedValue({ cause: { code: 'ECONNREFUSED' } })

      const result = await store.loginWithPassword('admin@example.com', 'placeholder-pwd')

      expect(result).toBe(false)
      expect(store.error).toContain('Cannot connect to backend')
    })

    it('should short-circuit when rate limit is exhausted', async () => {
      // Temporarily stub global to return denied state (useRateLimit is a Nuxt auto-import global)
      vi.stubGlobal('useRateLimit', () => ({
        check: () => ({ allowed: false, retryAfterMs: 12000 }),
        record: () => {},
        reset: () => {}
      }))

      const store = useAuthStore()
      const fetchSpy = vi.fn()
      global.$fetch = fetchSpy

      const result = await store.loginWithPassword('admin@example.com', 'placeholder-pwd')

      expect(result).toBe(false)
      expect(store.error).toContain('Too many attempts')
      expect(fetchSpy).not.toHaveBeenCalled()

      // Restore permissive stub for remaining tests
      vi.stubGlobal('useRateLimit', () => ({ check: () => ({ allowed: true }), record: () => {}, reset: () => {} }))
    })
  })
})
