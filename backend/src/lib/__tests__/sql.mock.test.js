import { describe, it, expect, vi, beforeEach } from 'vitest'
import sqlMock from '../__mocks__/sql.js'

// Helper: create a tagged-template-literal style call
// In real postgres-js, sql`SELECT 1` passes an array with .raw property.
function taggedCall(strings, ...values) {
  const arr = [...strings]
  arr.raw = strings
  return sqlMock(arr, ...values)
}

describe('sql mock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('function type', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(sqlMock)).toBe(true)
    })

    it('exposes a begin method', () => {
      expect(typeof sqlMock.begin).toBe('function')
      expect(vi.isMockFunction(sqlMock.begin)).toBe(true)
    })
  })

  describe('passthrough for non-template-literal calls', () => {
    it('returns the first argument unchanged when input is not an array', async () => {
      const input = { some: 'object' }
      const result = await sqlMock(input)
      expect(result).toBe(input)
    })

    it('returns the first argument when it is a plain array without .raw', async () => {
      const arr = ['SELECT 1']
      const result = await sqlMock(arr)
      expect(result).toBe(arr)
    })
  })

  describe('SELECT 1 query routing', () => {
    it('returns [{ "?column?": 1 }] for SELECT 1', async () => {
      const result = await taggedCall(['SELECT 1'])
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('matches SELECT 1 case-insensitively', async () => {
      const arr = ['select 1']
      arr.raw = arr
      const result = await sqlMock(arr)
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('matches SELECT 1 with leading/trailing whitespace', async () => {
      const arr = ['  SELECT 1  ']
      arr.raw = arr
      const result = await sqlMock(arr)
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('matches SELECT 10 because regex /^select\\s+1/ is a prefix match', async () => {
      // The regex /^select\s+1/ matches any query starting with "select <whitespace> 1",
      // so "select 10" also matches – this is a known behaviour of the mock.
      const arr = ['SELECT 10']
      arr.raw = arr
      const result = await sqlMock(arr)
      expect(result).toEqual([{ '?column?': 1 }])
    })
  })

  describe('SELECT COUNT(*) query routing', () => {
    it('returns [{ count: 0 }] for SELECT COUNT(*) queries', async () => {
      const arr = ['SELECT COUNT(*) FROM products']
      arr.raw = arr
      const result = await sqlMock(arr)
      expect(result).toEqual([{ count: 0 }])
    })

    it('matches count with spaces around asterisk', async () => {
      const arr = ['SELECT COUNT( * ) FROM products']
      arr.raw = arr
      const result = await sqlMock(arr)
      expect(result).toEqual([{ count: 0 }])
    })

    it('matches count case-insensitively', async () => {
      const arr = ['select count(*) from products']
      arr.raw = arr
      const result = await sqlMock(arr)
      expect(result).toEqual([{ count: 0 }])
    })
  })

  describe('INSERT INTO admins query routing', () => {
    it('returns the mockAdmin object for INSERT INTO admins', async () => {
      const arr = ['INSERT INTO admins (email, name) VALUES (']
      arr.raw = arr
      const result = await sqlMock(arr, 'test@example.com', 'test')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'test-uuid',
        email: 'test@example.com',
        name: 'test',
        role: 'admin',
        isActive: true,
        currentChallenge: null,
        challengeExpiresAt: null,
      })
    })

    it('matches INSERT INTO admins case-insensitively', async () => {
      const arr = ['insert into admins (email) values (']
      arr.raw = arr
      const result = await sqlMock(arr, 'x@x.com')
      expect(result[0]).toHaveProperty('role', 'admin')
    })
  })

  describe('unknown queries', () => {
    it('returns empty array for unrecognized queries', async () => {
      const arr = ['SELECT * FROM products WHERE id = ']
      arr.raw = arr
      const result = await sqlMock(arr, 1)
      expect(result).toEqual([])
    })

    it('returns empty array for UPDATE statements', async () => {
      const arr = ['UPDATE admins SET name = ']
      arr.raw = arr
      const result = await sqlMock(arr, 'new-name')
      expect(result).toEqual([])
    })

    it('returns empty array for DELETE statements', async () => {
      const arr = ['DELETE FROM sessions WHERE id = ']
      arr.raw = arr
      const result = await sqlMock(arr, 'session-id')
      expect(result).toEqual([])
    })
  })

  describe('begin() transaction support', () => {
    it('calls the callback with sqlMock as the transaction client', async () => {
      const callback = vi.fn().mockResolvedValue('tx-result')
      const result = await sqlMock.begin(callback)
      expect(callback).toHaveBeenCalledWith(sqlMock)
      expect(result).toBe('tx-result')
    })

    it('returns the value resolved by the callback', async () => {
      const expectedValue = [{ id: 'test-uuid' }]
      const result = await sqlMock.begin(async (tx) => {
        return await tx(['INSERT INTO admins (email) VALUES ('].concat([]))
      })
      // The begin callback receives sqlMock, so calling it with an array without .raw returns the array
      expect(Array.isArray(result)).toBe(true)
    })

    it('is tracked as a vi mock call', async () => {
      await sqlMock.begin(async () => 'done')
      expect(sqlMock.begin).toHaveBeenCalledTimes(1)
    })

    it('can run nested sql calls inside transaction', async () => {
      let capturedTx
      await sqlMock.begin(async (tx) => {
        capturedTx = tx
        const arr = ['SELECT 1']
        arr.raw = arr
        return tx(arr)
      })
      expect(capturedTx).toBe(sqlMock)
    })
  })

  describe('call tracking', () => {
    it('records all invocations', async () => {
      const a1 = ['SELECT 1']
      a1.raw = a1
      const a2 = ['SELECT COUNT(*) FROM t']
      a2.raw = a2
      await sqlMock(a1)
      await sqlMock(a2)
      expect(sqlMock).toHaveBeenCalledTimes(2)
    })

    it('call count resets after vi.clearAllMocks()', async () => {
      const arr = ['SELECT 1']
      arr.raw = arr
      await sqlMock(arr)
      vi.clearAllMocks()
      expect(sqlMock).toHaveBeenCalledTimes(0)
    })
  })

  describe('multi-part template literal (interpolated values)', () => {
    it('joins string parts and routes on combined query', async () => {
      // Simulate: sql`SELECT 1` → strings = ['SELECT 1'], values = []
      const parts = ['SELECT 1']
      parts.raw = parts
      const result = await sqlMock(parts)
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('joins parts from multi-segment template for INSERT', async () => {
      // Simulate: sql`INSERT INTO admins (email) VALUES (${email})`
      // strings = ['INSERT INTO admins (email) VALUES (', ')'], values = ['test@example.com']
      const parts = ['INSERT INTO admins (email) VALUES (', ')']
      parts.raw = parts
      const result = await sqlMock(parts, 'test@example.com')
      expect(result[0]).toHaveProperty('id', 'test-uuid')
    })
  })
})