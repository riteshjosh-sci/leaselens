import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createCheckoutSession } from '../lib/stripe'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Pricing.module.css'

const PLANS = [
  {
    id: 'one_off',
    tier: 'One-off report',
    price: '$49',
    priceSub: 'per report',
    originalPrice: '$79',
    desc: 'A single full analysis. No subscription required.',
    features: [
      'Free risk scan included',
      'Full clause-by-clause report',
      'Counter positions for each issue',
      'Downloadable PDF',
      'All Australian states',
    ],
    cta: 'Get one report',
    featured: false,
  },
  {
    id: 'monthly',
    tier: 'Monthly',
    price: '$99',
    priceSub: 'per month',
    originalPrice: '$149/mo',
    desc: 'Unlimited analyses across the full lease negotiation process.',
    features: [
      'Unlimited HOA and lease analyses',
      'Full reports on every revision',
      'Document history and version tracking',
      'Version comparison',
      'Cancel anytime',
    ],
    cta: 'Start monthly plan',
    featured: true,
  },
  {
    id: 'annual',
    tier: 'Annual',
    price: '$950',
    priceSub: 'per year',
    originalPrice: '$1,430/yr',
    desc: 'Everything in Monthly, billed annually. Save 20%.',
    features: [
      'Everything in Monthly',
      'Save 20% vs monthly',
      'Priority analysis',
      'Early access to new features',
    ],
    cta: 'Start annual plan',
    featured: false,
  },
  {
    id: 'adviser',
    tier: 'Professional',
    price: '$299',
    priceSub: 'per month',
    originalPrice: '$499/mo',
    desc: 'For tenant representatives managing multiple client negotiations.',
    features: [
      'Everything in Monthly',
      'Multiple client workspaces',
      'Branded PDF reports',
      'Client sharing',
      'Usage analytics dashboard',
      'Unlimited analyses',
    ],
    cta: 'Start professional plan',
    featured: false,
  },
]

export default function Pricing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')

  const handleCheckout = async (planId) => {
    if (!user) { navigate('/signup'); return }
    setLoading(planId)
    setError('')
    try {
      const url = await createCheckoutSession({
        plan: planId,
        userId: user.id,
        userEmail: user.email,
      })
      window.location.href = url
    } catch (e) {
      setError(e.message)
      setLoading(null)
    }
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.kicker}>Founding member pricing</div>
          <h1 className={styles.h1}>A fraction of the cost<br /><em>of getting it wrong.</em></h1>
          <p className={styles.sub}>Founding member pricing is available for a limited time. Lock in your rate before it increases.</p>
          <div className={styles.foundingBadge}>
            🔒 Founding member pricing — lock in your rate before it increases
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.grid}>
          {PLANS.map(plan => (
            <div key={plan.id} className={`${styles.card} ${plan.featured ? styles.featured : ''}`}>
              {plan.featured && <div className={styles.popularTag}>Most popular</div>}

              <div className={styles.tier}>{plan.tier}</div>
              <div className={styles.priceRow}>
                <div className={styles.price}>{plan.price}</div>
                <div className={styles.priceMeta}>
                  <div className={styles.priceSub}>{plan.priceSub}</div>
                  <div className={styles.originalPrice}>↑ {plan.originalPrice} after founding period</div>
                </div>
              </div>

              <p className={styles.desc}>{plan.desc}</p>
              <div className={styles.rule} />

              <ul className={styles.features}>
                {plan.features.map(f => (
                  <li key={f}>
                    <span className={styles.check}>·</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`${styles.btn} ${plan.featured ? styles.btnFeatured : ''}`}
                onClick={() => handleCheckout(plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? 'Redirecting...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <p>All prices in Australian dollars. Subscriptions renew automatically and can be cancelled at any time. Existing subscribers will never be moved to higher pricing automatically.</p>
        </div>
      </div>
      <Footer />
    </>
  )
}
