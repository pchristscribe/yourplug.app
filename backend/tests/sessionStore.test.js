import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RedisSessionStore } from '../src/lib/sessionStore.js'

/**
 * Unit tests for RedisSessionStore.
 * All Redis operations are mocked; no real Redis connection is used.
 */

function makeRedisClient() {
  return {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  }
}

describe('RedisSessionStore', () => {
  let client
  let store

  beforeEach(() => {
    client = makeRedisClient()
    store = new RedisSessionStore(client)
  })

  // ── Constructor ───────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('sets the key prefix to "sess:"', () => {
      expect(store.prefix).toBe('sess:')
    })

    it('sets TTL to 7 days in seconds', () => {
      expect(store.ttl).toBe(60 * 60 * 24 * 7)
    })

    it('stores the provided Redis client', () => {
      expect(store.client).toBe(client)
    })
  })

  // ── get() ─────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns parsed session data when the key exists', async () => {
      const sessionData = { adminId: 'uuid-1', createdAt: '2025-01-01' }
      client.get.mockResolvedValue(JSON.stringify(sessionData))

      const result = await new Promise((resolve, reject) => {
        store.get('session-id', (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })

      expect(result).toEqual(sessionData)
      expect(client.get).toHaveBeenCalledWith('sess:session-id')
    })

    it('returns null when the key does not exist', async () => {
      client.get.mockResolvedValue(null)

      const result = await new Promise((resolve, reject) => {
        store.get('missing-id', (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })

      expect(result).toBeNull()
    })

    it('calls the callback with an error when Redis fails', async () => {
      const redisErr = new Error('Redis unavailable')
      client.get.mockRejectedValue(redisErr)

      const error = await new Promise((resolve) => {
        store.get('any-id', (err) => resolve(err))
      })

      expect(error).toBe(redisErr)
    })

    it('prepends the prefix when calling Redis get', async () => {
      client.get.mockResolvedValue(null)
      await new Promise((resolve) => store.get('abc', resolve))
      expect(client.get).toHaveBeenCalledWith('sess:abc')
    })
  })

  // ── set() ─────────────────────────────────────────────────────────────────

  describe('set()', () => {
    it('serializes and stores session data with the correct TTL', async () => {
      client.setex.mockResolvedValue('OK')
      const session = { adminId: 'u1', role: 'admin' }

      await new Promise((resolve, reject) => {
        store.set('session-id', session, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      expect(client.setex).toHaveBeenCalledWith(
        'sess:session-id',
        store.ttl,
        JSON.stringify(session)
      )
    })

    it('calls the callback with no error on success', async () => {
      client.setex.mockResolvedValue('OK')

      const error = await new Promise((resolve) => {
        store.set('sid', { foo: 'bar' }, (err) => resolve(err))
      })

      expect(error).toBeUndefined()
    })

    it('calls the callback with an error when Redis fails', async () => {
      const redisErr = new Error('Write failed')
      client.setex.mockRejectedValue(redisErr)

      const error = await new Promise((resolve) => {
        store.set('sid', { foo: 'bar' }, (err) => resolve(err))
      })

      expect(error).toBe(redisErr)
    })

    it('stores nested session objects correctly', async () => {
      client.setex.mockResolvedValue('OK')
      const session = { user: { id: 1, name: 'Admin' }, meta: { ip: '127.0.0.1' } }

      await new Promise((resolve, reject) => {
        store.set('nested-sid', session, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      expect(client.setex).toHaveBeenCalledWith(
        'sess:nested-sid',
        store.ttl,
        JSON.stringify(session)
      )
    })
  })

  // ── destroy() ─────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('deletes the session key from Redis', async () => {
      client.del.mockResolvedValue(1)

      await new Promise((resolve, reject) => {
        store.destroy('session-id', (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      expect(client.del).toHaveBeenCalledWith('sess:session-id')
    })

    it('calls the callback with no error on success', async () => {
      client.del.mockResolvedValue(1)

      const error = await new Promise((resolve) => {
        store.destroy('sid', (err) => resolve(err))
      })

      expect(error).toBeUndefined()
    })

    it('calls the callback with an error when Redis fails', async () => {
      const redisErr = new Error('Delete failed')
      client.del.mockRejectedValue(redisErr)

      const error = await new Promise((resolve) => {
        store.destroy('sid', (err) => resolve(err))
      })

      expect(error).toBe(redisErr)
    })

    it('deletes a key that does not exist without error', async () => {
      client.del.mockResolvedValue(0) // 0 = key was not found, but no error

      const error = await new Promise((resolve) => {
        store.destroy('non-existent-id', (err) => resolve(err))
      })

      expect(error).toBeUndefined()
      expect(client.del).toHaveBeenCalledWith('sess:non-existent-id')
    })
  })

  // ── Key prefix consistency ────────────────────────────────────────────────

  describe('key prefix consistency', () => {
    it('all operations use the same prefix', async () => {
      const sessionId = 'my-session-id'
      const expected = `${store.prefix}${sessionId}`

      client.get.mockResolvedValue(null)
      client.setex.mockResolvedValue('OK')
      client.del.mockResolvedValue(1)

      await new Promise((r) => store.get(sessionId, r))
      await new Promise((r) => store.set(sessionId, {}, r))
      await new Promise((r) => store.destroy(sessionId, r))

      expect(client.get).toHaveBeenCalledWith(expected)
      expect(client.setex.mock.calls[0][0]).toBe(expected)
      expect(client.del).toHaveBeenCalledWith(expected)
    })
  })
})