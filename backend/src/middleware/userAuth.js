import { createClient } from '@supabase/supabase-js'

let _supabase = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NUXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    )
  }
  return _supabase
}

export async function userAuth(request, reply) {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
  const { data, error } = await getSupabase().auth.getUser(auth.slice(7))
  if (error || !data.user) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
  request.userId = data.user.id
}
