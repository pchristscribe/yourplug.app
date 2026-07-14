// Shared by the adminAuth middleware and auth.js's GET /session — both need
// to look up an admin by session ID and check isActive before trusting it.
export async function loadActiveAdminById(sql, id) {
  const [admin] = await sql`
    select id, email, name, role, is_active, last_login_at
    from admins
    where id = ${id}
  `
  return admin || null
}
