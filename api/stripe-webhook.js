import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Use service role key for webhook — bypasses RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    // Vercel provides raw body via req.body when Content-Type is application/json
    const rawBody = JSON.stringify(req.body)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {

      // ── One-off payment completed ──
      case 'checkout.session.completed': {
        const session = event.data.object
        const { userId, plan } = session.metadata || {}
        if (!userId) break

        if (plan === 'one_off') {
          // Add one scan credit
          const { data: profile } = await supabase
            .from('profiles')
            .select('scan_credits')
            .eq('id', userId)
            .single()

          await supabase.from('profiles').update({
            plan: 'one_off',
            scan_credits: (profile?.scan_credits || 0) + 1,
            stripe_customer_id: session.customer,
          }).eq('id', userId)
        }
        break
      }

      // ── Subscription activated or updated ──
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object
        const { userId, plan, founding } = sub.metadata || {}
        if (!userId) break

        await supabase.from('profiles').update({
          plan: plan || 'monthly',
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items.data[0]?.price?.id,
          founding_member: founding === 'true',
          subscription_status: sub.status,
        }).eq('id', userId)
        break
      }

      // ── Subscription cancelled ──
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { userId } = sub.metadata || {}
        if (!userId) break

        await supabase.from('profiles').update({
          plan: 'free',
          stripe_subscription_id: null,
          subscription_status: 'cancelled',
        }).eq('id', userId)
        break
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export const config = { api: { bodyParser: true } }
