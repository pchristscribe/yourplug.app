import { describe, it, expect, vi } from 'vitest'
import { adminAuth, csrfProtection, generateCsrfToken } from '../src/middleware/adminAuth.js'

function makeReply() {
  const reply = { code: vi.fn(), send: vi.fn() }
  reply.code.mockReturnValue(reply)
  return reply
}

function makeRequest(overrides = {}) {
  return {
    session: { adminId: 'admin-uuid-1' },
    server: { sql: vi.fn() },
    admin: undefined,
    ...overrides,
  }
}

describe('adminAuth middleware', () => {
  it('returns 401 when request has no session', async () => {
    const request = makeRequest({ session: null })
    const reply = makeReply()

    await adminAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized' })
    )
  })

  it('returns 401 when session exists but has no adminId', async () => {
    const request = makeRequest({ session: {} })
    const reply = makeReply()

    await adminAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
  })

  it('attaches admin to request when session adminId resolves to active admin', async () => {
    const admin = { id: 'admin-uuid-1', email: 'admin@test.com', name: 'Admin', role: 'admin', isActive: true }
    const request = makeRequest()
    request.server.sql.mockResolvedValue([admin])
    const reply = makeReply()

    await adminAuth(request, reply)

    expect(request.admin).toEqual(admin)
    expect(reply.code).not.toHaveBeenCalled()
  })

  it('returns 401 and destroys session when admin not found', async () => {
    const request = makeRequest()
    request.session.destroy = vi.fn()
    request.server.sql.mockResolvedValue([])
    const reply = makeReply()

    await adminAuth(request, reply)

    expect(request.session.destroy).toHaveBeenCalled()
    expect(reply.code).toHaveBeenCalledWith(401)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized' })
    )
  })

  it('returns 401 and destroys session when admin is inactive', async () => {
    const admin = { id: 'admin-uuid-1', isActive: false }
    const request = makeRequest()
    request.session.destroy = vi.fn()
    request.server.sql.mockResolvedValue([admin])
    const reply = makeReply()

    await adminAuth(request, reply)

    expect(request.session.destroy).toHaveBeenCalled()
    expect(reply.code).toHaveBeenCalledWith(401)
  })
})

// ─── generateCsrfToken ────────────────────────────────────────────────────────

describe('generateCsrfToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateCsrfToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns a different token on each call', () => {
    const a = generateCsrfToken()
    const b = generateCsrfToken()
    expect(a).not.toBe(b)
  })
})

// ─── csrfProtection ──────────────────────────────────────────────────────────

describe('csrfProtection middleware', () => {
  function makeCsrfRequest(overrides = {}) {
    return {
      method: 'POST',
      session: { csrfToken: 'valid-token-abc' },
      headers: { 'x-csrf-token': 'valid-token-abc' },
      ...overrides,
    }
  }

  it('passes GET requests without checking the token', async () => {
    const request = makeCsrfRequest({ method: 'GET', headers: {} })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })

  it('passes HEAD requests without checking the token', async () => {
    const request = makeCsrfRequest({ method: 'HEAD', headers: {} })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })

  it('passes OPTIONS requests without checking the token', async () => {
    const request = makeCsrfRequest({ method: 'OPTIONS', headers: {} })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })

  it('passes POST requests with a matching token', async () => {
    const request = makeCsrfRequest()
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })

  it('passes PATCH requests with a matching token', async () => {
    const request = makeCsrfRequest({ method: 'PATCH' })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })

  it('passes DELETE requests with a matching token', async () => {
    const request = makeCsrfRequest({ method: 'DELETE' })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })

  it('returns 403 when x-csrf-token header is missing', async () => {
    const request = makeCsrfRequest({ headers: {} })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' })
    )
  })

  it('returns 403 when header token does not match session token', async () => {
    const request = makeCsrfRequest({ headers: { 'x-csrf-token': 'wrong-token' } })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
  })

  it('returns 403 when session has no csrfToken', async () => {
    const request = makeCsrfRequest({ session: {} })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
  })

  it('returns 403 when session is null', async () => {
    const request = makeCsrfRequest({ session: null })
    const reply = makeReply()

    await csrfProtection(request, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
  })
})
