import { defineStore } from 'pinia'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { getOrCreateCsrfToken, rotateCsrfToken, clearCsrfToken } from '~/utils/security'
import * as Sentry from '@sentry/nuxt'

interface Admin {
  id: string
  email: string
  name: string
  role: string
}

// Email validation regex - RFC 5322 compliant basic pattern
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

// Device name constraints
const MAX_DEVICE_NAME_LENGTH = 100
const DEVICE_NAME_SANITIZE_REGEX = /[<>"'`\\]/g

/**
 * Validates email input with comprehensive checks
 * @param email - The email to validate
 * @returns Object with isValid boolean and optional error message
 */
function validateEmail(email: unknown): { isValid: boolean; error?: string; normalized?: string } {
  // Type check - must be a string
  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a string' }
  }

  // Trim whitespace
  const trimmed = email.trim()

  // Empty check after trim
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Email is required' }
  }

  // Length check (practical limits)
  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email is too long' }
  }

  // Format validation
  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' }
  }

  // Normalize to lowercase
  const normalized = trimmed.toLowerCase()

  return { isValid: true, normalized }
}

/**
 * Sanitizes device name input
 * @param deviceName - The device name to sanitize
 * @returns Sanitized device name or undefined
 */
function sanitizeDeviceName(deviceName: unknown): string | undefined {
  // Type check
  if (typeof deviceName !== 'string') {
    return undefined
  }

  // Trim whitespace
  const trimmed = deviceName.trim()

  // Empty check
  if (trimmed.length === 0) {
    return undefined
  }

  // Remove potentially dangerous characters (XSS prevention)
  const sanitized = trimmed.replace(DEVICE_NAME_SANITIZE_REGEX, '')

  // Enforce length limit
  const truncated = sanitized.substring(0, MAX_DEVICE_NAME_LENGTH)

  return truncated.length > 0 ? truncated : undefined
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    admin: null as Admin | null,
    loading: false,
    error: null as string | null
  }),

  getters: {
    isAuthenticated: (state) => !!state.admin,
    adminName: (state) => state.admin?.name || 'Admin'
  },

  actions: {
    async registerSecurityKey(email: unknown, deviceName?: unknown) {
      // WebAuthn is client-side only, guard against SSR
      if (typeof window === 'undefined') {
        return false
      }

      // Validate email input BEFORE setting loading state
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        this.error = emailValidation.error || 'Invalid email'
        return false
      }

      const validatedEmail = emailValidation.normalized!
      const sanitizedDeviceName = sanitizeDeviceName(deviceName)

      const rateLimit = useRateLimit()
      const rateLimitCheck = rateLimit.check('register')
      if (!rateLimitCheck.allowed) {
        const seconds = Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000)
        this.error = `Too many attempts. Please try again in ${seconds} seconds.`
        return false
      }

      this.loading = true
      this.error = null

      try {
        const config = useRuntimeConfig()

        // Get registration options from server
        const optionsResponse = await $fetch(`${config.public.apiBase}/api/admin/webauthn/register/options`, {
          method: 'POST',
          body: { email: validatedEmail },
          credentials: 'include',
          headers: { 'X-CSRF-Token': getOrCreateCsrfToken() }
        }) as any

        // Trigger browser WebAuthn registration
        const credential = await startRegistration({ optionsJSON: optionsResponse })

        // Send credential to server for verification
        const verificationResponse = await $fetch(`${config.public.apiBase}/api/admin/webauthn/register/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': getOrCreateCsrfToken() },
          body: {
            email: validatedEmail,
            credential,
            deviceName: sanitizedDeviceName
          }
        })

        if (verificationResponse.verified) rateLimit.reset('register')
        return verificationResponse.verified
      } catch (err: any) {
        rateLimit.record('register')
        Sentry.captureException(err, { tags: { operation: 'webauthn_register' } })

        // Provide user-friendly error messages
        if (err.name === 'NotAllowedError') {
          this.error = 'Registration was cancelled or timed out. Please try again.'
        } else if (err.name === 'SecurityError') {
          this.error = 'Security error. Make sure you are accessing via http://localhost:3002'
        } else if (err.name === 'InvalidStateError') {
          this.error = 'This security key is already registered for this account.'
        } else if (err.name === 'NotSupportedError') {
          this.error = 'Your browser does not support WebAuthn/TouchID. Try Safari, Chrome, or Edge.'
        } else if (err.message?.includes('fetch') || err.cause?.code === 'ECONNREFUSED') {
          this.error = 'Cannot connect to backend server. Make sure it\'s running on port 3001.'
        } else if (err.statusCode === 404 || err.status === 404) {
          this.error = 'Backend API not found. Make sure backend is running with correct routes.'
        } else {
          // Safely extract error message
          const errorMsg = err.data?.error || err.message || String(err) || 'Registration failed. Check browser console for details.'
          this.error = errorMsg
        }

        return false
      } finally {
        this.loading = false
      }
    },

    async loginWithSecurityKey(email: unknown) {
      // WebAuthn is client-side only, guard against SSR
      if (typeof window === 'undefined') {
        return false
      }

      // Validate email input BEFORE setting loading state
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        this.error = emailValidation.error || 'Invalid email'
        return false
      }

      const validatedEmail = emailValidation.normalized!

      const rateLimit = useRateLimit()
      const rateLimitCheck = rateLimit.check('login')
      if (!rateLimitCheck.allowed) {
        const seconds = Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000)
        this.error = `Too many attempts. Please try again in ${seconds} seconds.`
        return false
      }

      this.loading = true
      this.error = null

      try {
        const config = useRuntimeConfig()

        // Get authentication options from server
        const optionsResponse = await $fetch(`${config.public.apiBase}/api/admin/webauthn/authenticate/options`, {
          method: 'POST',
          body: { email: validatedEmail },
          headers: { 'X-CSRF-Token': getOrCreateCsrfToken() }
        })

        // Trigger browser WebAuthn authentication
        const credential = await startAuthentication({ optionsJSON: optionsResponse })

        // Send credential to server for verification
        const verificationResponse = await $fetch(`${config.public.apiBase}/api/admin/webauthn/authenticate/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': getOrCreateCsrfToken() },
          body: {
            email: validatedEmail,
            credential
          }
        })

        if (verificationResponse.verified && verificationResponse.admin) {
          this.admin = verificationResponse.admin
          rateLimit.reset('login')
          rotateCsrfToken()
          return true
        }
        return false
      } catch (err: any) {
        rateLimit.record('login')
        Sentry.captureException(err, { tags: { operation: 'webauthn_login' } })

        // Provide user-friendly error messages
        if (err.name === 'NotAllowedError') {
          this.error = 'Authentication was cancelled or timed out. Please try again.'
        } else if (err.name === 'SecurityError') {
          this.error = 'Security error. Make sure you are accessing via http://localhost:3002'
        } else if (err.data?.error === 'No security keys registered. Please register a key first.') {
          this.error = 'No security keys registered. Click "Register Security Key" below to get started.'
        } else if (err.message?.includes('fetch') || err.cause?.code === 'ECONNREFUSED') {
          this.error = 'Cannot connect to backend server. Make sure it\'s running on port 3001.'
        } else if (err.statusCode === 404 || err.status === 404) {
          this.error = 'Backend API not found. Make sure backend is running with correct routes.'
        } else {
          // Safely extract error message
          const errorMsg = err.data?.error || err.message || String(err) || 'Authentication failed. Check browser console for details.'
          this.error = errorMsg
        }

        return false
      } finally {
        this.loading = false
      }
    },

    async loginWithPassword(email: unknown, password: unknown) {
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        this.error = emailValidation.error || 'Invalid email'
        return false
      }

      if (typeof password !== 'string' || password.length === 0) {
        this.error = 'Password is required'
        return false
      }

      const validatedEmail = emailValidation.normalized!

      const rateLimit = useRateLimit()
      const rateLimitCheck = rateLimit.check('login')
      if (!rateLimitCheck.allowed) {
        const seconds = Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000)
        this.error = `Too many attempts. Please try again in ${seconds} seconds.`
        return false
      }

      this.loading = true
      this.error = null

      try {
        const config = useRuntimeConfig()
        const response = await $fetch(`${config.public.apiBase}/api/admin/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': getOrCreateCsrfToken() },
          body: { email: validatedEmail, password }
        }) as { success?: boolean; admin?: Admin }

        if (response.success && response.admin) {
          this.admin = response.admin
          rateLimit.reset('login')
          rotateCsrfToken()
          return true
        }
        this.error = 'Unexpected response from server'
        return false
      } catch (err: any) {
        rateLimit.record('login')
        Sentry.captureException(err, { tags: { operation: 'password_login' } })
        if (err.statusCode === 401 || err.status === 401) {
          this.error = 'Invalid email or password'
        } else if (err.statusCode === 403 || err.status === 403) {
          this.error = err.data?.message || 'Account is inactive'
        } else if (err.message?.includes('fetch') || err.cause?.code === 'ECONNREFUSED') {
          this.error = 'Cannot connect to backend server. Make sure it\'s running on port 3001.'
        } else {
          this.error = err.data?.error || err.message || 'Login failed'
        }
        return false
      } finally {
        this.loading = false
      }
    },

    async checkSession() {
      try {
        const config = useRuntimeConfig()
        const response = await $fetch(`${config.public.apiBase}/api/admin/auth/session`, {
          credentials: 'include'
        })

        if (response.authenticated && response.admin) {
          this.admin = response.admin
          return true
        }
        this.admin = null
        return false
      } catch {
        this.admin = null
        return false
      }
    },

    async logout() {
      try {
        const config = useRuntimeConfig()
        await $fetch(`${config.public.apiBase}/api/admin/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': getOrCreateCsrfToken() }
        })
      } catch (err) {
        Sentry.captureException(err, { level: 'warning', tags: { operation: 'logout' } })
      } finally {
        this.admin = null
        clearCsrfToken()
      }
    }
  }
})
