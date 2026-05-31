import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const rawBody = await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => data += chunk)
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })

  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        const { userId, plan, founding } = session.metadata || {}
        if (!userId) break

        if (plan === 'one_off') {
          // One-off payment — add scan credit
          const { data: profile } = await supabase.from('profiles').select('scan_credits').eq('id', userId).single()
          await supabase.from('profiles').update({
            plan: 'one_off',
            scan_credits: (profile?.scan_credits || 0) + 1,
            stripe_customer_id: session.customer,
          }).eq('id', userId)
        } else {
          // Subscription — update plan immediately from checkout session
          // Don't wait for subscription.created which may lack metadata
          await supabase.from('profiles').update({
            plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            founding_member: founding === 'true',
            subscription_status: 'active',
          }).eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const { userId, plan, founding } = sub.metadata || {}

        // Try metadata first, fall back to looking up by customer ID
        let profileUserId = userId
        if (!profileUserId && sub.customer) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', sub.customer)
            .single()
          profileUserId = profile?.id
        }

        if (!profileUserId) break

        await supabase.from('profiles').update({
          plan: plan || 'monthly',
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items.data[0]?.price?.id,
          founding_member: founding === 'true',
          subscription_status: sub.status,
        }).eq('id', profileUserId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { userId } = sub.metadata || {}

        let profileUserId = userId
        if (!profileUserId && sub.customer) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', sub.customer)
            .single()
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
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}