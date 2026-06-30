import { vi } from 'vitest'

const redisMock = {
  on: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn().mockResolvedValue(null),
  setex: vi.fn().mockResolvedValue('OK'),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
}

// @fastify/rate-limit's RedisStore calls defineCommand('rateLimit', ...) during
// plugin init, then invokes redis.rateLimit(..., cb) on every request.
// This implementation actually registers the named command so requests don't 500.
redisMock.defineCommand = vi.fn((name) => {
  if (!redisMock[name]) {
    redisMock[name] = vi.fn((...args) => {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') cb(null, [1, 60000])
    })
  }
})

export default redisMock
