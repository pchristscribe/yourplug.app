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

const fn = vi.fn(async (strings, ..._values) => {
  if (!strings?.raw) return strings
  const first = strings[0].trim().toLowerCase()
  const full = strings.join('').toLowerCase()
  if (full.includes('insert into admins')) return [mockAdmin]
  if (first.startsWith('select count(*)')) return [{ count: 0 }]
  if (first.startsWith('select 1')) return [{ '?column?': 1 }]
  return []
})
fn.begin = vi.fn(async (f) => f(fn))

export default fn
