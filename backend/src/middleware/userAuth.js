import { getSupabase } from '../lib/supabase.js'

const AUTH_TIMEOUT_MS = 5000

export async function userAuth(request, reply) {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }

  // Bound the external auth lookup so a slow Supabase call can't hang
  // every authenticated request indefinitely.
  let timer
  try {
    const timeout = new Promise((_, rejectFn) => {
      timer = setTimeout(() => rejectFn(new Error('auth timeout')), AUTH_TIMEOUT_MS)
    })
    const { data, error } = await Promise.race([
      getSupabase().auth.getUser(auth.slice(7)),
      timeout,
    ])
    if (error || !data.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    request.userId = data.user.id
  } catch (err) {
    request.log.error({ err }, 'User auth lookup failed')
    return reply.code(503).send({ error: 'Authentication service unavailable' })
  } finally {
    clearTimeout(timer)
  }
}
