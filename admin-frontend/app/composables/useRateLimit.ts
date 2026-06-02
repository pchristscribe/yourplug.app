const MAX_ATTEMPTS = 5
const WINDOW_MS = 60_000
const LOCKOUT_MS = 300_000

const noop = { check: () => ({ allowed: true } as const), record: () => {}, reset: () => {} }

// Module-level map so state persists across calls within the same page session.
// Each call to useRateLimit() returns closures over this shared map.
const attempts = new Map<string, { count: number; resetAt: number }>()

export function useRateLimit() {
  if (import.meta.server) return noop

  function check(action: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now()
    const entry = attempts.get(action)

    if (entry && now < entry.resetAt) {
      if (entry.count >= MAX_ATTEMPTS) {
        return { allowed: false, retryAfterMs: entry.resetAt - now }
      }
      return { allowed: true }
    }

    if (!entry || now >= entry.resetAt) {
      attempts.set(action, { count: 0, resetAt: now + WINDOW_MS })
    }

    return { allowed: true }
  }

  function record(action: string) {
    const now = Date.now()
    const entry = attempts.get(action)

    if (entry && now < entry.resetAt) {
      entry.count++
      if (entry.count >= MAX_ATTEMPTS) {
        entry.resetAt = now + LOCKOUT_MS
      }
    } else {
      attempts.set(action, { count: 1, resetAt: now + WINDOW_MS })
    }
  }

  function reset(action: string) {
    attempts.delete(action)
  }

  return { check, record, reset }
}
