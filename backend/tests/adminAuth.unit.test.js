import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminAuth } from '../src/middleware/adminAuth.js'

/**
 * Unit tests for the adminAuth middleware.
 * The middleware is called with (request, reply) and should:
 *  - Return 401 when there is no session or no adminId in the session
 *  - Return 401 and destroy the session when the admin row is not found or is inactive
 *  - Set request.admin and allow the request to pass through when valid
 */

function makeReply() {
  const reply = {
    _code: null,
    _body: null,
    code(c) {
      this._code = c
      return this
    },
    send(body) {
      this._body = body
      return this
    },
  }
  return reply
}

describe('adminAuth middleware', () => {
  let reply

  beforeEach(() => {
    reply = makeReply()
  })

  // ── No session ────────────────────────────────────────────────────────────

  it('returns 401 when request.session is undefined', async () => {
    const request = { session: undefined, server: {} }
    await adminAuth(request, reply)
    expect(reply._code).toBe(401)
    expect(reply._body).toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 401 when request.session is null', async () => {
    const request = { session: null, server: {} }
    await adminAuth(request, reply)
    expect(reply._code).toBe(401)
  })

  it('returns 401 when session exists but adminId is missing', async () => {
    const request = { session: {}, server: {} }
    await adminAuth(request, reply)
    expect(reply._code).toBe(401)
    expect(reply._body.message).toMatch(/log in/i)
  })

  it('returns 401 when adminId is an empty string', async () => {
    const request = { session: { adminId: '' }, server: {} }
    await adminAuth(request, reply)
    expect(reply._code).toBe(401)
  })

  it('returns 401 when adminId is null', async () => {
    const request = { session: { adminId: null }, server: {} }
    await adminAuth(request, reply)
    expect(reply._code).toBe(401)
  })

  // ── Admin not found ───────────────────────────────────────────────────────

  it('returns 401 and destroys the session when admin row is not found', async () => {
    const destroy = vi.fn()
    const sql = vi.fn().mockResolvedValue([]) // empty result
    const request = {
      session: { adminId: 'some-uuid', destroy },
      server: { sql },
    }
    await adminAuth(request, reply)
    expect(reply._code).toBe(401)
    expect(reply._body.message).toMatch(/not found|inactive/i)
    expect(destroy).toHaveBeenCalledOnce()
  })

  // ── Admin inactive ────────────────────────────────────────────────────────

  it('returns 401 and destroys the session when admin.isActive is false', async () => {
    const destroy = vi.fn()
    const sql = vi.fn().mockResolvedValue([
      { id: 'some-uuid', email: 'admin@test.com', name: 'Test', role: 'admin', isActive: false },
    ])
    const request = {
      session: { adminId: 'some-uuid', destroy },
      server: { sql },
    }
    await adminAuth(request, reply)
    expect(reply._code).toBe(401)
    expect(destroy).toHaveBeenCalledOnce()
  })

  // ── Valid admin ───────────────────────────────────────────────────────────

  it('sets request.admin and does not set a reply code when admin is active', async () => {
    const adminRecord = {
      id: 'uuid-1',
      email: 'active@test.com',
      name: 'Active Admin',
      role: 'admin',
      isActive: true,
    }
    const sql = vi.fn().mockResolvedValue([adminRecord])
    const request = {
      session: { adminId: 'uuid-1' },
      server: { sql },
    }
    await adminAuth(request, reply)
    expect(reply._code).toBeNull()
    expect(request.admin).toEqual(adminRecord)
  })

  it('passes through for a super-admin role', async () => {
    const adminRecord = {
      id: 'uuid-2',
      email: 'super@test.com',
      name: 'Super',
      role: 'super_admin',
      isActive: true,
    }
    const sql = vi.fn().mockResolvedValue([adminRecord])
    const request = {
      session: { adminId: 'uuid-2' },
      server: { sql },
    }
    await adminAuth(request, reply)
    expect(request.admin.role).toBe('super_admin')
    expect(reply._code).toBeNull()
  })

  // ── SQL query uses the correct adminId ───────────────────────────────────

  it('queries the DB with the adminId from the session', async () => {
    const sql = vi.fn().mockResolvedValue([
      { id: 'query-uuid', email: 'a@b.com', name: 'A', role: 'admin', isActive: true },
    ])
    const request = {
      session: { adminId: 'query-uuid' },
      server: { sql },
    }
    await adminAuth(request, reply)
    // The template tag should have been called (it is a tagged template literal)
    expect(sql).toHaveBeenCalled()
  })

  // ── Error propagation ─────────────────────────────────────────────────────

  it('propagates unexpected DB errors', async () => {
    const dbError = new Error('DB connection lost')
    const sql = vi.fn().mockRejectedValue(dbError)
    const request = {
      session: { adminId: 'some-uuid' },
      server: { sql },
    }
    await expect(adminAuth(request, reply)).rejects.toThrow('DB connection lost')
  })
})