import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RedisSessionStore } from '../src/lib/sessionStore.js'

function makeClient() {
  return {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  }
}

describe('RedisSessionStore', () => {
  let client
  let store

  beforeEach(() => {
    client = makeClient()
    store = new RedisSessionStore(client)
  })

  // ─── get ──────────────────────────────────────────────────────────────────

  it('get calls callback with parsed session when key exists', async () => {
    const sessionData = { adminId: 'abc', foo: 'bar' }
    client.get.mockResolvedValue(JSON.stringify(sessionData))
    const cb = vi.fn()

    await store.get('sess-123', cb)

    expect(client.get).toHaveBeenCalledWith('sess:sess-123')
    expect(cb).toHaveBeenCalledWith(null, sessionData)
  })

  it('get calls callback with null when key does not exist', async () => {
    client.get.mockResolvedValue(null)
    const cb = vi.fn()

    await store.get('missing', cb)

    expect(cb).toHaveBeenCalledWith(null, null)
  })

  it('get calls callback with error on redis failure', async () => {
    const err = new Error('Redis down')
    client.get.mockRejectedValue(err)
    const cb = vi.fn()

    await store.get('sess-err', cb)

    expect(cb).toHaveBeenCalledWith(err)
  })

  // ─── set ──────────────────────────────────────────────────────────────────

  it('set stores serialized session with TTL via setex', async () => {
    client.setex.mockResolvedValue('OK')
    const session = { adminId: 'xyz', iat: Date.now() }
    const cb = vi.fn()

    await store.set('sess-456', session, cb)

    expect(client.setex).toHaveBeenCalledWith(
      'sess:sess-456',
      store.ttl,
      JSON.stringify(session)
    )
    expect(cb).toHaveBeenCalledWith(null)
  })

  it('set calls callback with error on redis failure', async () => {
    const err = new Error('Write failed')
    client.setex.mockRejectedValue(err)
    const cb = vi.fn()

    await store.set('sess-err', {}, cb)

    expect(cb).toHaveBeenCalledWith(err)
  })

  // ─── destroy ──────────────────────────────────────────────────────────────

  it('destroy deletes the prefixed session key', async () => {
    client.del.mockResolvedValue(1)
    const cb = vi.fn()

    await store.destroy('sess-789', cb)

    expect(client.del).toHaveBeenCalledWith('sess:sess-789')
    expect(cb).toHaveBeenCalledWith(null)
  })

  it('destroy calls callback with error on redis failure', async () => {
    const err = new Error('Delete failed')
    client.del.mockRejectedValue(err)
    const cb = vi.fn()

    await store.destroy('sess-err', cb)

    expect(cb).toHaveBeenCalledWith(err)
  })

  // ─── constructor defaults ─────────────────────────────────────────────────

  it('uses "sess:" prefix and 7-day TTL by default', () => {
    expect(store.prefix).toBe('sess:')
    expect(store.ttl).toBe(60 * 60 * 24 * 7)
  })
})
