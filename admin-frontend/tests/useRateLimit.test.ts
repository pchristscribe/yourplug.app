import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useRateLimit } from '../app/composables/useRateLimit'

// The module-level `attempts` map persists across calls within a test file,
// so each test uses its own unique action key to avoid cross-test pollution.
let actionCounter = 0
function uniqueAction() {
  return `action-${actionCounter++}`
}

describe('useRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows the first check for a fresh action', () => {
    const { check } = useRateLimit()
    expect(check(uniqueAction())).toEqual({ allowed: true })
  })

  it('allows up to the attempt limit within the window', () => {
    const { check, record } = useRateLimit()
    const action = uniqueAction()

    for (let i = 0; i < 4; i++) {
      record(action)
      expect(check(action)).toEqual({ allowed: true })
    }
  })

  it('blocks once the attempt limit is reached and reports retryAfterMs', () => {
    const { check, record } = useRateLimit()
    const action = uniqueAction()

    for (let i = 0; i < 5; i++) record(action)

    const result = check(action)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('extends the lockout window (5 min) once the limit is hit', () => {
    const { check, record } = useRateLimit()
    const action = uniqueAction()

    for (let i = 0; i < 5; i++) record(action)
    const blockedAt0 = check(action)

    vi.setSystemTime(4 * 60_000) // 4 minutes later — still inside the 5-minute lockout
    const stillBlocked = check(action)

    expect(blockedAt0.allowed).toBe(false)
    expect(stillBlocked.allowed).toBe(false)
  })

  it('allows again once the lockout window has fully elapsed', () => {
    const { check, record } = useRateLimit()
    const action = uniqueAction()

    for (let i = 0; i < 5; i++) record(action)
    expect(check(action).allowed).toBe(false)

    vi.setSystemTime(5 * 60_000 + 1) // just past the 5-minute lockout
    expect(check(action)).toEqual({ allowed: true })
  })

  it('resets the attempt count after the 60s window elapses without hitting the limit', () => {
    const { check, record } = useRateLimit()
    const action = uniqueAction()

    record(action)
    record(action)
    vi.setSystemTime(60_001) // past the 60s window
    expect(check(action)).toEqual({ allowed: true })

    // Confirm the count actually reset, not just the window: five more records
    // should be needed to trip the limit again.
    for (let i = 0; i < 4; i++) record(action)
    expect(check(action).allowed).toBe(true)
    record(action)
    expect(check(action).allowed).toBe(false)
  })

  it('reset() clears an action so it is immediately allowed again', () => {
    const { check, record, reset } = useRateLimit()
    const action = uniqueAction()

    for (let i = 0; i < 5; i++) record(action)
    expect(check(action).allowed).toBe(false)

    reset(action)
    expect(check(action)).toEqual({ allowed: true })
  })

  it('tracks separate actions independently', () => {
    const { check, record } = useRateLimit()
    const login = uniqueAction()
    const webauthn = uniqueAction()

    for (let i = 0; i < 5; i++) record(login)

    expect(check(login).allowed).toBe(false)
    expect(check(webauthn)).toEqual({ allowed: true })
  })
})
