// RFC 5322 simplified — shared by admin/auth.js (password login) and
// admin/webauthn.js (security-key registration/login) so the two flows
// can't drift into accepting different email formats.
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function validateEmail(email) {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' }
  }

  const trimmed = email.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' }
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' }
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' }
  }

  return { valid: true, email: trimmed.toLowerCase() }
}
