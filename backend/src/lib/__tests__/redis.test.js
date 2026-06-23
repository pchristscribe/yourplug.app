import { describe, it, expect, vi, beforeEach } from 'vitest'
import redisMock from '../__mocks__/redis.js'

describe('redis mock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ping', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.ping)).toBe(true)
    })

    it('resolves to "PONG"', async () => {
      const result = await redisMock.ping()
      expect(result).toBe('PONG')
    })

    it('records calls', async () => {
      await redisMock.ping()
      expect(redisMock.ping).toHaveBeenCalledTimes(1)
    })
  })

  describe('get', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.get)).toBe(true)
    })

    it('resolves to null by default', async () => {
      const result = await redisMock.get('some-key')
      expect(result).toBeNull()
    })

    it('records the key argument', async () => {
      await redisMock.get('session:abc123')
      expect(redisMock.get).toHaveBeenCalledWith('session:abc123')
    })
  })

  describe('setex', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.setex)).toBe(true)
    })

    it('resolves to "OK"', async () => {
      const result = await redisMock.setex('key', 3600, 'value')
      expect(result).toBe('OK')
    })

    it('records key, ttl, and value arguments', async () => {
      await redisMock.setex('session:xyz', 86400, JSON.stringify({ adminId: '1' }))
      expect(redisMock.setex).toHaveBeenCalledWith(
        'session:xyz',
        86400,
        JSON.stringify({ adminId: '1' })
      )
    })
  })

  describe('set', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.set)).toBe(true)
    })

    it('resolves to "OK"', async () => {
      const result = await redisMock.set('my-key', 'my-value')
      expect(result).toBe('OK')
    })

    it('records key and value arguments', async () => {
      await redisMock.set('lock:resource', '1')
      expect(redisMock.set).toHaveBeenCalledWith('lock:resource', '1')
    })
  })

  describe('del', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.del)).toBe(true)
    })

    it('resolves to 1 (number of deleted keys)', async () => {
      const result = await redisMock.del('some-key')
      expect(result).toBe(1)
    })

    it('records the key argument', async () => {
      await redisMock.del('session:abc')
      expect(redisMock.del).toHaveBeenCalledWith('session:abc')
    })
  })

  describe('on', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.on)).toBe(true)
    })

    it('can be called with event name and handler', () => {
      const handler = vi.fn()
      redisMock.on('error', handler)
      expect(redisMock.on).toHaveBeenCalledWith('error', handler)
    })

    it('records multiple event registrations', () => {
      const errorHandler = vi.fn()
      const connectHandler = vi.fn()
      redisMock.on('error', errorHandler)
      redisMock.on('connect', connectHandler)
      expect(redisMock.on).toHaveBeenCalledTimes(2)
    })
  })

  describe('mock structure', () => {
    it('exposes all expected methods', () => {
      expect(redisMock).toHaveProperty('on')
      expect(redisMock).toHaveProperty('ping')
      expect(redisMock).toHaveProperty('get')
      expect(redisMock).toHaveProperty('setex')
      expect(redisMock).toHaveProperty('set')
      expect(redisMock).toHaveProperty('del')
    })

    it('all methods are callable functions', () => {
      expect(typeof redisMock.on).toBe('function')
      expect(typeof redisMock.ping).toBe('function')
      expect(typeof redisMock.get).toBe('function')
      expect(typeof redisMock.setex).toBe('function')
      expect(typeof redisMock.set).toBe('function')
      expect(typeof redisMock.del).toBe('function')
    })
  })
})