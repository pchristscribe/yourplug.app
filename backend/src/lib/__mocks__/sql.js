import { vi } from 'vitest'

const mockAdmin = {
  id: 'test-uuid',
  email: 'test@example.com',
  name: 'test',
  role: 'admin',
  isActive: true,
  currentChallenge: null,
  challengeExpiresAt: null,
}

const sqlMock = vi.fn(async (strings, ...values) => {
  if (!Array.isArray(strings) || !strings.raw) {
    return strings
  }

  const query = strings.join('').trim().toLowerCase()

  if (/^select\s+1/.test(query)) {
    return [{ '?column?': 1 }]
  }

  if (/select\s+count\s*\(\s*\*\s*\)/.test(query)) {
    return [{ count: '0' }]
  }

  if (/insert\s+into\s+admins/.test(query)) {
    return [mockAdmin]
  }

  return []
})

sqlMock.begin = vi.fn(async (callback) => callback(sqlMock))

export default sqlMock
