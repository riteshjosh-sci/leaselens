import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Called by ProtectedRoute when a session exists but the account never
// passed the beta code gate (e.g. signed up via the Login page's Google
// button, which has no gating UI of its own). Hard-deletes the account so
// the same email can be used to sign up properly later.
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // Re-verify server-side before deleting -- never trust the client's claim alone
    const { data: profile } = await supabase
      .from('profiles')
      .select('beta_validated')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.beta_validated) {
      return res.status(400).json({ error: 'Account is beta-validated, refusing to delete' })
    }

    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.admin.deleteUser(user.id)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Reject unauthorized account error:', err)
    return res.status(500).json({ error: err.message })
  }
}
