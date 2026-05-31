import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function buffer(readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const rawBody = await buffer(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        const { userId, plan, founding } = session.metadata || {}
        if (!userId) break

        if (plan === 'one_off') {
          const { data: profile } = await supabase.from('profiles').select('scan_credits').eq('id', userId).single()
          const { error } = await supabase.from('profiles').update({
            plan: 'one_off',
            scan_credits: (profile?.scan_credits || 0) + 1,
            stripe_customer_id: session.customer,
          }).eq('id', userId)
          if (error) console.error('Supabase error:', error)
        } else {
          const { error } = await supabase.from('profiles').update({
            plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            founding_member: founding === 'true',
            subscription_status: 'active',
          }).eq('id', userId)
          if (error) console.error('Supabase error:', error)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const { userId, plan, founding } = sub.metadata || {}

        let profileUserId = userId
        if (!profileUserId && sub.customer) {
          const { data: profile } = await supabase
            .from('profiles').select('id')
            .eq('stripe_customer_id', sub.customer).single()
          profileUserId = profile?.id
        }
        if (!profileUserId) break

        const { error } = await supabase.from('profiles').update({
          plan: plan || 'monthly',
          stripe_subscription_id: sub.id,
          founding_member: founding === 'true',
          subscription_status: sub.status,
        }).eq('id', profileUserId)
        if (error) console.error('Supabase error:', error)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        let profileUserId = sub.metadata?.userId
        if (!profileUserId && sub.customer) {
          const { data: profile } = await supabase
            .from('profiles').select('id')
            .eq('stripe_customer_id', sub.customer).single()
          profileUserId = profile?.id
        }
        if (!profileUserId) break
        await supabase.from('profiles').update({
          plan: 'free',
          stripe_subscription_id: null,
          subscription_status: 'cancelled',
        }).eq('id', profileUserId)
        break
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(500).json({ error: err.message })
  }
}