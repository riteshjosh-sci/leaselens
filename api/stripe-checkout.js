import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Price ID map — founding vs standard per plan
const PRICES = {
  one_off:  { founding: 'price_1TdELACtxJYrkZjf3kupaC3U', standard: 'price_1TdEMtCtxJYrkZjf6vUavKrt' },
  monthly:  { founding: 'price_1TdEOtCtxJYrkZjfnN7QCdSa', standard: 'price_1TdEOtCtxJYrkZjfDxFsYz8v' },
  annual:   { founding: 'price_1TdEPkCtxJYrkZjf7MTOX0zN', standard: 'price_1TdEQbCtxJYrkZjfgE5oADxZ' },
  adviser:  { founding: 'price_1TdERBCtxJYrkZjfTSAieIJ2', standard: 'price_1TdERmCtxJYrkZjffA5AiJQ0' },
}

// Founding period flag — set to false when founding period ends
const FOUNDING_PERIOD_ACTIVE = true

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { plan, userId, userEmail, successUrl, cancelUrl } = req.body

  if (!plan || !userId || !userEmail) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const priceGroup = PRICES[plan]
  if (!priceGroup) return res.status(400).json({ error: 'Invalid plan' })

  const priceId = FOUNDING_PERIOD_ACTIVE ? priceGroup.founding : priceGroup.standard
  const isSubscription = plan !== 'one_off'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.origin}/dashboard?payment=success`,
      cancel_url: cancelUrl || `${req.headers.origin}/pricing?payment=cancelled`,
      metadata: {
        userId,
        plan,
        founding: FOUNDING_PERIOD_ACTIVE ? 'true' : 'false',
      },
      subscription_data: isSubscription ? {
        metadata: { userId, plan, founding: FOUNDING_PERIOD_ACTIVE ? 'true' : 'false' }
      } : undefined,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
