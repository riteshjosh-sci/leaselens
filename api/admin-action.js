import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.email !== process.env.VITE_ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' })

  const { action, payload } = req.body

  try {
    switch (action) {
      case 'updatePlan': {
        const { error } = await supabase.from('profiles').update({ plan: payload.plan }).eq('id', payload.userId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'suspendUser': {
        const { error } = await supabase.from('profiles').update({ suspended: payload.suspended }).eq('id', payload.userId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'deleteUser': {
        const { error } = await supabase.from('profiles').delete().eq('id', payload.userId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'deleteDocument': {
        if (payload.filePath) await supabase.storage.from('documents').remove([payload.filePath])
        await supabase.from('reports').delete().eq('document_id', payload.docId)
        const { error } = await supabase.from('documents').delete().eq('id', payload.docId)
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'addBetaCode': {
        const { error } = await supabase.from('beta_codes').insert({ code: payload.code, used: false })
        if (error) throw error
        return res.status(200).json({ success: true })
      }
      case 'deactivateBetaCode': {
        const { error } = await supabase.from('beta_codes').update({ used: true }).eq('id', payload.id)
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
