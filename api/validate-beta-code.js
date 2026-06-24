import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Beta codes must never be readable from the client -- the anon key is public,
// and an unrestricted SELECT/UPDATE policy on beta_codes would let anyone
// enumerate unused codes and self-issue signup access. This endpoint is the
// only path allowed to read or redeem a code.
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const code = (req.body?.code || '').trim().toUpperCase()
  if (!code) return res.status(400).json({ valid: false, reason: 'missing_code' })

  try {
    // Atomic redeem: only succeeds if the code exists and is not already used.
    const { data, error } = await supabase
      .from('beta_codes')
      .update({ used: true })
      .eq('code', code)
      .eq('used', false)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (data) return res.status(200).json({ valid: true })

    // Redemption failed -- find out why, for a useful error message only.
    const { data: existing } = await supabase
      .from('beta_codes')
      .select('used')
      .eq('code', code)
      .maybeSingle()

    if (existing?.used) return res.status(200).json({ valid: false, reason: 'already_used' })
    return res.status(200).json({ valid: false, reason: 'not_found' })
  } catch (err) {
    console.error('Beta code validation error:', err)
    return res.status(500).json({ valid: false, reason: 'server_error' })
  }
}
