import { describe, it, expect, vi, beforeEach } from 'vitest'
import sqlMock from '../__mocks__/sql.js'

const mockAdmin = {
  id: 'test-uuid',
  email: 'test@example.com',
  name: 'test',
  role: 'admin',
  isActive: true,
  currentChallenge: null,
  challengeExpiresAt: null,
}

describe('sql mock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('tagged template literal behavior', () => {
    it('handles SELECT 1 query and returns health-check row', async () => {
      const strings = Object.assign(['SELECT 1'], { raw: ['SELECT 1'] })
      const result = await sqlMock(strings)
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('is case-insensitive for SELECT 1', async () => {
      const strings = Object.assign(['select 1'], { raw: ['select 1'] })
      const result = await sqlMock(strings)
      expect(result).toEqual([{ '?column?': 1 }])
    })

    it('handles SELECT COUNT(*) query and returns zero count', async () => {
      const strings = Object.assign(['SELECT COUNT(*) FROM admins'], {
        raw: ['SELECT COUNT(*) FROM admins'],
      })
      const result = await sqlMock(strings)
      expect(result).toEqual([{ count: 0 }])
    })

    it('handles SELECT count(*) (lowercase) and returns zero count', async () => {
      const strings = Object.assign(['select count(*) from products'], {
        raw: ['select count(*) from products'],
      })
      const result = await sqlMock(strings)
      expect(result).toEqual([{ count: 0 }])
    })

    it('handles INSERT INTO admins and returns mockAdmin', async () => {
      const strings = Object.assign(
        ['INSERT INTO admins (email) VALUES (', ')'],
        { raw: ['INSERT INTO admins (email) VALUES (', ')'] }
      )
      const result = await sqlMock(strings, 'test@example.com')
      expect(result).toEqual([mockAdmin])
      expect(result[0]).toHaveProperty('id', 'test-uuid')
      expect(result[0]).toHaveProperty('email', 'test@example.com')
      expect(result[0]).toHaveProperty('role', 'admin')
      expect(result[0]).toHaveProperty('isActive', true)
    })

    it('returns empty array for unrecognized queries', async () => {
      const strings = Object.assign(['SELECT * FROM products WHERE id = ', ''], {
        raw: ['SELECT * FROM products WHERE id = ', ''],
      })
      const result = await sqlMock(strings, 'some-id')
      expect(result).toEqual([])
    })

    it('handles UPDATE queries by returning empty array', async () => {
      const strings = Object.assign(['UPDATE admins SET name = ', ' WHERE id = ', ''], {
        raw: ['UPDATE admins SET name = ', ' WHERE id = ', ''],
      })
      const result = await sqlMock(strings, 'new-name', 'some-id')
      expect(result).toEqual([])
    })

    it('handles DELETE queries by returning empty array', async () => {
      const strings = Object.assign(['DELETE FROM admins WHERE id = ', ''], {
        raw: ['DELETE FROM admins WHERE id = ', ''],
      })
      const result = await sqlMock(strings, 'some-id')
      expect(result).toEqual([])
    })
  })

  describe('non-template-literal passthrough', () => {
    it('passes through non-array input unchanged', async () => {
      const input = { someKey: 'someValue' }
      const result = await sqlMock(input)
      expect(result).toBe(input)
    })

    it('passes through plain array (without .raw) unchanged', async () => {
      const input = ['plain', 'array']
      const result = await sqlMock(input)
      expect(result).toBe(input)
    })

    it('passes through a string input unchanged', async () => {
      const result = await sqlMock('raw sql string')
      expect(result).toBe('raw sql string')
    })
  })

  describe('sqlMock.begin', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(sqlMock.begin)).toBe(true)
    })

    it('calls the callback with sqlMock and returns callback result', async () => {
      const callbackResult = [{ id: 1 }]
      const callback = vi.fn().mockResolvedValue(callbackResult)

      const result = await sqlMock.begin(callback)

      expect(callback).toHaveBeenCalledWith(sqlMock)
      expect(result).toBe(callbackResult)
    })

    it('provides sqlMock to callback so nested queries can be issued', async () => {
      let capturedSql
      await sqlMock.begin(async (tx) => {
        capturedSql = tx
      })
      expect(capturedSql).toBe(sqlMock)
    })

    it('propagates errors thrown inside the transaction callback', async () => {
      const err = new Error('transaction error')
      await expect(
        sqlMock.begin(async () => {
          throw err
        })
      ).rejects.toThrow('transaction error')
    })
  })

  describe('mock function properties', () => {
    it('is a vi mock function', () => {
      expect(vi.isMockFunction(sqlMock)).toBe(true)
    })

    it('records calls when invoked', async () => {
      vi.clearAllMocks()
      const strings = Object.assign(['SELECT 1'], { raw: ['SELECT 1'] })
      await sqlMock(strings)
      expect(sqlMock).toHaveBeenCalledTimes(1)
      expect(sqlMock).toHaveBeenCalledWith(strings)
    })
  })
})