import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.email !== process.env.VITE_ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' })

  const { resource } = req.query

  try {
    const queries = {
      profiles: () => supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      documents: () => supabase.from('documents').select('*, negotiations(property_name)').order('uploaded_at', { ascending: false }).limit(200),
      reports: () => supabase.from('reports').select('id, created_at, document_id, user_id').order('created_at', { ascending: false }).limit(200),
      beta_codes: () => supabase.from('beta_codes').select('*').order('created_at', { ascending: false }),
      waitlist: () => supabase.from('waitlist').select('*').order('created_at', { ascending: false }),
      workspaces: () => supabase.from('workspaces').select('id, name, client_name, logo_path, delivery_email, created_at, user_id, negotiations(id)').order('created_at', { ascending: false }),
      feedback: () => supabase.from('feedback').select('*').order('created_at', { ascending: false }),

    }

    if (!queries[resource]) return res.status(400).json({ error: 'Invalid resource' })

    const { data, error: qError } = await queries[resource]()
    if (qError) throw qError
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
