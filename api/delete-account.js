import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const userId = user.id

  try {
    // 1. Cancel any active Stripe subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .single()

    if (profile?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id)
      } catch (e) {
        console.warn('Stripe cancel failed (continuing with deletion):', e.message)
      }
    }

    // 2. Mark profile as deleted, clear billing references.
    // Workspaces, negotiations, and documents are left untouched —
    // only the account and its billing are deactivated.
    await supabase.from('profiles').update({
      deleted_at: new Date().toISOString(),
      plan: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: 'cancelled',
    }).eq('id', userId)

    // 3. Ban the auth user so they can no longer sign in (soft-delete, recoverable by support)
    await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Delete account error:', err)
    return res.status(500).json({ error: err.message })
  }
}
