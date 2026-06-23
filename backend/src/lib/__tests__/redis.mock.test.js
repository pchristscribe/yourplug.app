import { describe, it, expect, vi, beforeEach } from 'vitest'
import redisMock from '../__mocks__/redis.js'

describe('redis mock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('method existence', () => {
    it('exports an object with all expected methods', () => {
      expect(redisMock).toBeDefined()
      expect(typeof redisMock.on).toBe('function')
      expect(typeof redisMock.ping).toBe('function')
      expect(typeof redisMock.get).toBe('function')
      expect(typeof redisMock.setex).toBe('function')
      expect(typeof redisMock.set).toBe('function')
      expect(typeof redisMock.del).toBe('function')
    })
  })

  describe('ping()', () => {
    it('resolves with PONG by default', async () => {
      const result = await redisMock.ping()
      expect(result).toBe('PONG')
    })

    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.ping)).toBe(true)
    })

    it('tracks call count', async () => {
      await redisMock.ping()
      await redisMock.ping()
      expect(redisMock.ping).toHaveBeenCalledTimes(2)
    })
  })

  describe('get()', () => {
    it('resolves with null by default', async () => {
      const result = await redisMock.get('some-key')
      expect(result).toBeNull()
    })

    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.get)).toBe(true)
    })

    it('records the key argument', async () => {
      await redisMock.get('my-key')
      expect(redisMock.get).toHaveBeenCalledWith('my-key')
    })

    it('can be overridden to return a value', async () => {
      redisMock.get.mockResolvedValueOnce('cached-value')
      const result = await redisMock.get('my-key')
      expect(result).toBe('cached-value')
    })
  })

  describe('setex()', () => {
    it('resolves with OK by default', async () => {
      const result = await redisMock.setex('key', 60, 'value')
      expect(result).toBe('OK')
    })

    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.setex)).toBe(true)
    })

    it('records all arguments', async () => {
      await redisMock.setex('session-key', 3600, 'session-data')
      expect(redisMock.setex).toHaveBeenCalledWith('session-key', 3600, 'session-data')
    })
  })

  describe('set()', () => {
    it('resolves with OK by default', async () => {
      const result = await redisMock.set('key', 'value')
      expect(result).toBe('OK')
    })

    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.set)).toBe(true)
    })

    it('records key and value arguments', async () => {
      await redisMock.set('foo', 'bar')
      expect(redisMock.set).toHaveBeenCalledWith('foo', 'bar')
    })
  })

  describe('del()', () => {
    it('resolves with 1 by default', async () => {
      const result = await redisMock.del('key')
      expect(result).toBe(1)
    })

    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.del)).toBe(true)
    })

    it('records the key argument', async () => {
      await redisMock.del('session:123')
      expect(redisMock.del).toHaveBeenCalledWith('session:123')
    })

    it('can be overridden to simulate key not found (0 deleted)', async () => {
      redisMock.del.mockResolvedValueOnce(0)
      const result = await redisMock.del('nonexistent-key')
      expect(result).toBe(0)
    })
  })

  describe('on()', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(redisMock.on)).toBe(true)
    })

    it('can be called with event name and handler', () => {
      const handler = vi.fn()
      redisMock.on('error', handler)
      expect(redisMock.on).toHaveBeenCalledWith('error', handler)
    })
  })

  describe('mock reset behavior', () => {
    it('call counts reset to zero after vi.clearAllMocks()', async () => {
      await redisMock.ping()
      await redisMock.get('key')
      expect(redisMock.ping).toHaveBeenCalledTimes(1)
      expect(redisMock.get).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()

      expect(redisMock.ping).toHaveBeenCalledTimes(0)
      expect(redisMock.get).toHaveBeenCalledTimes(0)
    })

    it('default return values are restored after vi.clearAllMocks()', async () => {
      redisMock.ping.mockResolvedValueOnce('CUSTOM')
      vi.clearAllMocks()
      // After clearAllMocks default impl is reset; mockResolvedValue is cleared
      // ping now returns undefined (default mock return)
      const result = await redisMock.ping()
      expect(result).toBeUndefined()
    })
  })

  describe('error simulation', () => {
    it('ping can be configured to reject', async () => {
      redisMock.ping.mockRejectedValueOnce(new Error('Redis connection refused'))
      await expect(redisMock.ping()).rejects.toThrow('Redis connection refused')
    })

    it('get can be configured to reject', async () => {
      redisMock.get.mockRejectedValueOnce(new Error('READONLY'))
      await expect(redisMock.get('key')).rejects.toThrow('READONLY')
    })
  })
})