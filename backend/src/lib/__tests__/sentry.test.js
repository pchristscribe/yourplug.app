import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sanitizeSensitiveData, initSentry, captureException, captureMessage, flushSentry } from '../sentry.js'

vi.mock('@sentry/node', () => ({
  withScope: vi.fn((cb) => cb({ setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn() })),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  default: {},
}))

import * as Sentry from '@sentry/node'

describe('Sentry Data Sanitization', () => {
  describe('sanitizeSensitiveData', () => {
    it('should redact password fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com'
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.username).toBe('testuser')
      expect(sanitized.password).toBe('[REDACTED]')
      expect(sanitized.email).toBe('test@example.com')
    })

    it('should redact authorization headers', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer token123',
        'x-api-key': 'secret-key'
      }

      const sanitized = sanitizeSensitiveData(headers)

      expect(sanitized['content-type']).toBe('application/json')
      expect(sanitized['authorization']).toBe('[REDACTED]')
      expect(sanitized['x-api-key']).toBe('[REDACTED]')
    })

    it('should redact nested sensitive fields', () => {
      const data = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            token: 'abc123'
          }
        },
        metadata: {
          source: 'web'
        }
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.user.name).toBe('John')
      expect(sanitized.user.credentials.password).toBe('[REDACTED]')
      expect(sanitized.user.credentials.token).toBe('[REDACTED]')
      expect(sanitized.metadata.source).toBe('web')
    })

    it('should handle arrays with sensitive data', () => {
      const data = {
        users: [
          { username: 'user1', password: 'pass1' },
          { username: 'user2', apiKey: 'key2' }
        ]
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.users[0].username).toBe('user1')
      expect(sanitized.users[0].password).toBe('[REDACTED]')
      expect(sanitized.users[1].username).toBe('user2')
      expect(sanitized.users[1].apiKey).toBe('[REDACTED]')
    })

    it('should redact cookie values', () => {
      const data = {
        cookie: 'session=abc123; token=xyz789',
        session: 'session-id-123',
        sessionid: 'another-session'
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.cookie).toBe('[REDACTED]')
      expect(sanitized.session).toBe('[REDACTED]')
      expect(sanitized.sessionid).toBe('[REDACTED]')
    })

    it('should redact various token types', () => {
      const data = {
        csrf_token: 'csrf123',
        xsrf: 'xsrf456',
        api_token: 'api789',
        refresh_token: 'refresh000'
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.csrf_token).toBe('[REDACTED]')
      expect(sanitized.xsrf).toBe('[REDACTED]')
      expect(sanitized.api_token).toBe('[REDACTED]')
      expect(sanitized.refresh_token).toBe('[REDACTED]')
    })

    it('should handle null and undefined values', () => {
      const data = {
        value1: null,
        value2: undefined,
        value3: 'normal'
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.value1).toBe(null)
      expect(sanitized.value2).toBe(undefined)
      expect(sanitized.value3).toBe('normal')
    })

    it('should prevent infinite recursion with max depth', () => {
      const circular = { level: 1 }
      circular.nested = { level: 2, parent: circular }

      const sanitized = sanitizeSensitiveData(circular)

      expect(sanitized.level).toBe(1)
      expect(sanitized.nested.level).toBe(2)
    })

    it('should handle primitives', () => {
      expect(sanitizeSensitiveData('string')).toBe('string')
      expect(sanitizeSensitiveData(123)).toBe(123)
      expect(sanitizeSensitiveData(true)).toBe(true)
      expect(sanitizeSensitiveData(null)).toBe(null)
    })

    it('should be case-insensitive for sensitive field detection', () => {
      const data = {
        PASSWORD: 'secret1',
        Password: 'secret2',
        pAsSwOrD: 'secret3',
        TOKEN: 'token1',
        ApiKey: 'key1'
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.PASSWORD).toBe('[REDACTED]')
      expect(sanitized.Password).toBe('[REDACTED]')
      expect(sanitized.pAsSwOrD).toBe('[REDACTED]')
      expect(sanitized.TOKEN).toBe('[REDACTED]')
      expect(sanitized.ApiKey).toBe('[REDACTED]')
    })

    it('should redact credit card related fields', () => {
      const data = {
        cardNumber: '4111111111111111',
        ccn: '4111111111111111',
        cvv: '123',
        cvc: '456',
        ssn: '123-45-6789'
      }

      const sanitized = sanitizeSensitiveData(data)

      expect(sanitized.cardNumber).toBe('[REDACTED]')
      expect(sanitized.ccn).toBe('[REDACTED]')
      expect(sanitized.cvv).toBe('[REDACTED]')
      expect(sanitized.cvc).toBe('[REDACTED]')
      expect(sanitized.ssn).toBe('[REDACTED]')
    })
  })
})

describe('Sentry helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SENTRY_DSN
  })

  describe('initSentry', () => {
    it('logs warning when SENTRY_DSN is not set', () => {
      const fastify = { log: { warn: vi.fn(), info: vi.fn() } }
      initSentry(fastify)
      expect(fastify.log.warn).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN'))
    })

    it('logs info when SENTRY_DSN is set', () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123'
      const fastify = { log: { warn: vi.fn(), info: vi.fn() } }
      initSentry(fastify)
      expect(fastify.log.info).toHaveBeenCalledWith(expect.stringContaining('Sentry active'))
      delete process.env.SENTRY_DSN
    })
  })

  describe('captureException', () => {
    it('calls Sentry.captureException via withScope', () => {
      const err = new Error('test error')
      captureException(err, {})
      expect(Sentry.withScope).toHaveBeenCalled()
      expect(Sentry.captureException).toHaveBeenCalledWith(err)
    })

    it('sets user context when context.user is provided', () => {
      const err = new Error('test')
      const mockScope = { setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn() }
      Sentry.withScope.mockImplementationOnce((cb) => cb(mockScope))
      captureException(err, { user: { id: 'u1', password: 'secret' } })
      expect(mockScope.setUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', password: '[REDACTED]' })
      )
    })

    it('sets tags when context.tags is provided', () => {
      const err = new Error('test')
      const mockScope = { setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn() }
      Sentry.withScope.mockImplementationOnce((cb) => cb(mockScope))
      captureException(err, { tags: { env: 'test', version: '1.0' } })
      expect(mockScope.setTag).toHaveBeenCalledWith('env', 'test')
      expect(mockScope.setTag).toHaveBeenCalledWith('version', '1.0')
    })

    it('sets sanitized extra context when context.extra is provided', () => {
      const err = new Error('test')
      const mockScope = { setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn() }
      Sentry.withScope.mockImplementationOnce((cb) => cb(mockScope))
      captureException(err, { extra: { token: 'secret', safe: 'value' } })
      expect(mockScope.setContext).toHaveBeenCalledWith(
        'additional',
        expect.objectContaining({ token: '[REDACTED]', safe: 'value' })
      )
    })
  })

  describe('captureMessage', () => {
    it('calls Sentry.captureMessage with the message and level', () => {
      captureMessage('hello world', 'warning')
      expect(Sentry.captureMessage).toHaveBeenCalledWith('hello world', 'warning')
    })

    it('defaults to info level', () => {
      captureMessage('info message')
      expect(Sentry.captureMessage).toHaveBeenCalledWith('info message', 'info')
    })
  })

  describe('flushSentry', () => {
    it('calls Sentry.close when SENTRY_DSN is set', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/123'
      await flushSentry(1000)
      expect(Sentry.close).toHaveBeenCalledWith(1000)
      delete process.env.SENTRY_DSN
    })

    it('does not call Sentry.close when SENTRY_DSN is not set', async () => {
      await flushSentry()
      expect(Sentry.close).not.toHaveBeenCalled()
    })
  })
})
