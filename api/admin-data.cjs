const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.email !== process.env.VITE_ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' })

  const { resource } = req.query

  try {
    switch (resource) {
      case 'profiles': {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json(data)
      }
      case 'documents': {
        const { data, error } = await supabase.from('documents').select('*, negotiations(property_name)').order('uploaded_at', { ascending: false }).limit(200)
        if (error) throw error
        return res.status(200).json(data)
      }
      case 'reports': {
        const { data, error } = await supabase.from('reports').select('id, created_at, document_id, user_id').order('created_at', { ascending: false }).limit(200)
        if (error) throw error
        return res.status(200).json(data)
      }
      case 'beta_codes': {
        const { data, error } = await supabase.from('beta_codes').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json(data)
      }
      case 'waitlist': {
        const { data, error } = await supabase.from('waitlist').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json(data)
      }
      default:
        return res.status(400).json({ error: 'Invalid resource' })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
