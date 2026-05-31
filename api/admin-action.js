import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.email !== process.env.VITE_ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' })

  const { action, payload } = req.body

  try {
    switch (action) {
      case 'updatePlan': {
        const { userId, plan } = payload
        const { error } = await supabase.from('profiles').update({ plan }).eq('id', userId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'suspendUser': {
        const { userId, suspended } = payload
        const { error } = await supabase.from('profiles').update({ suspended }).eq('id', userId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'deleteUser': {
        const { userId } = payload
        const { error } = await supabase.from('profiles').delete().eq('id', userId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'deleteDocument': {
        const { docId, filePath } = payload
        if (filePath) await supabase.storage.from('documents').remove([filePath])
        await supabase.from('reports').delete().eq('document_id', docId)
        const { error } = await supabase.from('documents').delete().eq('id', docId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'addBetaCode': {
        const { code } = payload
        const { error } = await supabase.from('beta_codes').insert({ code, used: false })
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'deactivateBetaCode': {
        const { id } = payload
        const { error } = await supabase.from('beta_codes').update({ used: true }).eq('id', id)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
