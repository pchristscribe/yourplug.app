import { describe, it, expect, vi } from 'vitest'

const getSessionMock = vi.fn()
vi.stubGlobal('useSupabaseClient', () => ({ auth: { getSession: getSessionMock } }))

const { useAuthHeaders } = await import('../app/composables/useAuthHeaders')

describe('useAuthHeaders', () => {
  it('returns an Authorization header when a session token exists', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok123' } } })
    const { getAuthHeaders } = useAuthHeaders()
    await expect(getAuthHeaders()).resolves.toEqual({ Authorization: 'Bearer tok123' })
  })

  it('returns an empty object when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const { getAuthHeaders } = useAuthHeaders()
    await expect(getAuthHeaders()).resolves.toEqual({})
  })
})
