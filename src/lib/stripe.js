// Frontend Stripe helpers

export const PLANS = {
  one_off: {
    name: 'One-off report',
    price: '$49',
    description: 'Single full analysis',
  },
  monthly: {
    name: 'Monthly',
    price: '$99/mo',
    description: 'Unlimited analyses',
  },
  annual: {
    name: 'Annual',
    price: '$950/yr',
    description: 'Save 20% vs monthly',
  },
  adviser: {
    name: 'Professional',
    price: '$299/mo',
    description: 'Multiple client workspaces',
  },
}

export async function createCheckoutSession({ plan, userId, userEmail }) {
  const res = await fetch('/api/stripe-checkout.cjs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      userId,
      userEmail,
      successUrl: `${window.location.origin}/dashboard?payment=success`,
      cancelUrl: `${window.location.origin}/#pricing`,
    }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.url
}

// Feature gating helpers
export const canAnalyse = (profile) => {
  if (!profile) return false
  const plan = profile.plan || 'free'
  if (['monthly', 'annual', 'adviser'].includes(plan)) return true
  if (plan === 'one_off') return (profile.scan_credits || 0) > 0
  if (plan === 'free') return (profile.free_scans_used || 0) < 1
  return false
}

export const isSubscribed = (profile) =>
  ['monthly', 'annual', 'adviser'].includes(profile?.plan)

export const isAdviser = (profile) =>
  profile?.plan === 'adviser'
