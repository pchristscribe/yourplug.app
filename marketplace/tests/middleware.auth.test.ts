import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
const navigateToMock = vi.fn((to: string) => ({ redirectedTo: to }))

// defineNuxtRouteMiddleware is an identity wrapper at runtime — returning the
// handler unchanged lets the test invoke it directly.
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useSupabaseClient', () => ({ auth: { getSession: getSessionMock } }))

const authMiddleware = (await import('../app/middleware/auth')).default as () => Promise<unknown>

describe('auth middleware', () => {
  beforeEach(() => {
    getSessionMock.mockReset()
    navigateToMock.mockClear()
  })

  it('allows the navigation through when a session exists', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const result = await authMiddleware()
    expect(navigateToMock).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('redirects to /login when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    await authMiddleware()
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('returns the redirect so Nuxt halts the navigation', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const result = await authMiddleware()
    expect(result).toEqual({ redirectedTo: '/login' })
  })

  it('redirects to /login when the session lookup rejects', async () => {
    // An auth outage must fail closed, not fall through to the guarded page.
    getSessionMock.mockRejectedValue(new Error('supabase unreachable'))
    await authMiddleware()
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('redirects to /login when getSession resolves with an unexpected shape', async () => {
    getSessionMock.mockResolvedValue({})
    await authMiddleware()
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })
})
