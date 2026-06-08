import { describe, it, expect, vi } from 'vitest'
import { adminAuth } from '../src/middleware/adminAuth.js'

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
