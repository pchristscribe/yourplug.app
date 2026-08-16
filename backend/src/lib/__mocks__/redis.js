import { vi } from 'vitest'

const redisMock = {
  on: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn().mockResolvedValue(null),
  setex: vi.fn().mockResolvedValue('OK'),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
}

export default redisMock
