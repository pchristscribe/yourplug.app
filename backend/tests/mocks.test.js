import { describe, it, expect, vi } from 'vitest'
import redisMock from '../src/lib/__mocks__/redis.js'
import sqlMock from '../src/lib/__mocks__/sql.js'

// ─── Redis mock ───────────────────────────────────────────────────────────────

describe('Redis mock (__mocks__/redis.js)', () => {
  describe('exported shape', () => {
    it('exports an object with the expected methods', () => {
      expect(redisMock).toBeDefined()
      expect(typeof redisMock.on).toBe('function')
      expect(typeof redisMock.ping).toBe('function')
      expect(typeof redisMock.get).toBe('function')
      expect(typeof redisMock.setex).toBe('function')
      expect(typeof redisMock.set).toBe('function')
      expect(typeof redisMock.del).toBe('function')
    })

    it('all methods are vi mock functions', () => {
      expect(vi.isMockFunction(redisMock.on)).toBe(true)
      expect(vi.isMockFunction(redisMock.ping)).toBe(true)
      expect(vi.isMockFunction(redisMock.get)).toBe(true)
      expect(vi.isMockFunction(redisMock.setex)).toBe(true)
      expect(vi.isMockFunction(redisMock.set)).toBe(true)
      expect(vi.isMockFunction(redisMock.del)).toBe(true)
    })
  })

  describe('default resolved values', () => {
    it('ping resolves with "PONG"', async () => {
      await expect(redisMock.ping()).resolves.toBe('PONG')
    })

    it('get resolves with null', async () => {
      await expect(redisMock.get('any-key')).resolves.toBeNull()
    })

    it('setex resolves with "OK"', async () => {
      await expect(redisMock.setex('key', 60, 'value')).resolves.toBe('OK')
    })

    it('set resolves with "OK"', async () => {
      await expect(redisMock.set('key', 'value')).resolves.toBe('OK')
    })

    it('del resolves with 1', async () => {
      await expect(redisMock.del('key')).resolves.toBe(1)
    })

    it('on returns undefined (event binding side-effect, no meaningful return)', () => {
      const result = redisMock.on('error', () => {})
      // vi.fn() returns undefined by default — that is fine for event binding
      expect(result).toBeUndefined()
    })
  })

  describe('mock function recordkeeping', () => {
    it('ping records calls', async () => {
      redisMock.ping.mockClear()
      await redisMock.ping()
      expect(redisMock.ping).toHaveBeenCalledTimes(1)
    })

    it('get records the key argument', async () => {
      redisMock.get.mockClear()
      await redisMock.get('session:abc123')
      expect(redisMock.get).toHaveBeenCalledWith('session:abc123')
    })

    it('setex records all arguments', async () => {
      redisMock.setex.mockClear()
      await redisMock.setex('mykey', 300, 'myvalue')
      expect(redisMock.setex).toHaveBeenCalledWith('mykey', 300, 'myvalue')
    })

    it('del records the key argument', async () => {
      redisMock.del.mockClear()
      await redisMock.del('session:xyz')
      expect(redisMock.del).toHaveBeenCalledWith('session:xyz')
    })
  })
})

// ─── SQL mock ─────────────────────────────────────────────────────────────────

describe('SQL mock (__mocks__/sql.js)', () => {
  describe('exported shape', () => {
    it('exports a callable vi mock function', () => {
      expect(sqlMock).toBeDefined()
      expect(vi.isMockFunction(sqlMock)).toBe(true)
    })

    it('exports a begin method that is also a vi mock function', () => {
      expect(typeof sqlMock.begin).toBe('function')
      expect(vi.isMockFunction(sqlMock.begin)).toBe(true)
    })
  })

  describe('tagged template literal routing', () => {
    it('returns [{ "?column?": 1 }] for SELECT 1 queries', async () => {
      const result = await sqlMock`SELECT 1`
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('returns [{ "?column?": 1 }] for SELECT 1 with leading whitespace', async () => {
      const result = await sqlMock`  select 1  `
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('returns [{ count: 0 }] for SELECT COUNT(*) queries', async () => {
      const result = await sqlMock`SELECT COUNT(*) FROM admins`
      expect(result).toEqual([{ count: 0 }])
    })

    it('returns [{ count: 0 }] for select count(*) (case-insensitive)', async () => {
      const result = await sqlMock`select count(*) from categories`
      expect(result).toEqual([{ count: 0 }])
    })

    it('returns mockAdmin for INSERT INTO admins queries', async () => {
      const result = await sqlMock`INSERT INTO admins (email, name) VALUES (${'test@example.com'}, ${'Test'})`
      expect(result).toHaveLength(1)
      const admin = result[0]
      expect(admin).toHaveProperty('id', 'test-uuid')
      expect(admin).toHaveProperty('email', 'test@example.com')
      expect(admin).toHaveProperty('name', 'test')
      expect(admin).toHaveProperty('role', 'admin')
      expect(admin).toHaveProperty('isActive', true)
      expect(admin).toHaveProperty('currentChallenge', null)
      expect(admin).toHaveProperty('challengeExpiresAt', null)
    })

    it('returns [] for unrecognised queries', async () => {
      const result = await sqlMock`SELECT * FROM products WHERE id = ${'abc'}`
      expect(result).toEqual([])
    })

    it('returns [] for DELETE queries', async () => {
      const result = await sqlMock`DELETE FROM admins WHERE id = ${'test-uuid'}`
      expect(result).toEqual([])
    })

    it('returns [] for UPDATE queries', async () => {
      const result = await sqlMock`UPDATE admins SET is_active = true WHERE id = ${'test-uuid'}`
      expect(result).toEqual([])
    })

    it('handles non-template-literal call (passthrough): returns the argument unchanged', async () => {
      // When called as a plain function (no .raw), returns the first argument as-is.
      // This is intentional: sql(columnName) is the postgres-js identifier helper pattern.
      const obj = { foo: 'bar' }
      const result = await sqlMock(obj)
      expect(result).toBe(obj)
    })
  })

  describe('begin method', () => {
    it('calls the provided callback with the sql function', async () => {
      const callback = vi.fn(async (trx) => {
        return await trx`SELECT 1`
      })

      await sqlMock.begin(callback)
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(sqlMock)
    })

    it('returns the result of the callback', async () => {
      const result = await sqlMock.begin(async (_trx) => 'transaction-result')
      expect(result).toBe('transaction-result')
    })

    it('propagates errors thrown inside the callback', async () => {
      await expect(
        sqlMock.begin(async () => { throw new Error('tx failed') })
      ).rejects.toThrow('tx failed')
    })

    it('is a vi mock function (trackable)', () => {
      expect(vi.isMockFunction(sqlMock.begin)).toBe(true)
    })
  })

  describe('mock function recordkeeping', () => {
    it('records each tagged template call', async () => {
      sqlMock.mockClear()
      await sqlMock`SELECT 1`
      await sqlMock`SELECT COUNT(*) FROM admins`
      expect(sqlMock).toHaveBeenCalledTimes(2)
    })
  })
})
