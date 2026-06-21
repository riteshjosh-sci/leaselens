import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PLANS, openBillingPortal } from '../lib/stripe'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Profile.module.css'

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // personal details
  const [fullName, setFullName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsSaved, setDetailsSaved]   = useState(false)
  const [detailsError, setDetailsError]   = useState('')

  // password
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // billing
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingError, setBillingError]   = useState('')

  useEffect(() => { if (!user) { navigate('/login'); return }; fetchProfile() }, [user])

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
    setFullName(data?.full_name || '')
    setPhone(data?.phone || '')
    setLoading(false)
  }

  const handleSaveDetails = async () => {
    setSavingDetails(true); setDetailsError(''); setDetailsSaved(false)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      phone:     phone.trim() || null,
    }).eq('id', user.id)
    if (error) { setDetailsError(error.message); setSavingDetails(false); return }
    setDetailsSaved(true); setSavingDetails(false)
    setTimeout(() => setDetailsSaved(false), 2500)
  }

  const handleChangePassword = async () => {
    setPasswordError(''); setPasswordSaved(false)
    if (newPassword.length < 8)      return setPasswordError('At least 8 characters')
    if (!/[A-Z]/.test(newPassword))  return setPasswordError('At least one uppercase letter required')
    if (!/[0-9]/.test(newPassword))  return setPasswordError('At least one number required')
    if (newPassword !== confirmPassword) return setPasswordError('Passwords do not match')

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { setPasswordError(error.message); return }
    setNewPassword(''); setConfirmPassword('')
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 2500)
  }

  const handleManageBilling = async () => {
    setBillingError(''); setPortalLoading(true)
    try {
      const url = await openBillingPortal({ customerId: profile.stripe_customer_id })
      window.location.href = url
    } catch (e) {
      setBillingError(e.message || 'Could not open billing portal.')
      setPortalLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const getInitials = () => {
    if (fullName) return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  const planInfo = () => {
    const plan = profile?.plan || 'free'
    if (plan === 'free') {
      return { label: 'Free', detail: `${profile?.free_scans_used || 0} / 1 scan used` }
    }
    if (plan === 'one_off') {
      return { label: 'One-off', detail: `${profile?.scan_credits || 0} credit${profile?.scan_credits === 1 ? '' : 's'} remaining` }
    }
    if (plan === 'monthly' || plan === 'annual') {
      return { label: PLANS[plan]?.name || plan, detail: `${profile?.monthly_scans_used || 0} / 10 scans used this month` }
    }
    if (plan === 'adviser') {
      return { label: 'Professional', detail: 'Unlimited scans' }
    }
    return { label: plan, detail: '' }
  }

  if (loading || !profile) return <><Nav /><div className={styles.loading}>Loading…</div></>

  const { label: planLabel, detail: planDetail } = planInfo()

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <h1 className={styles.h1}>Your profile</h1>

        <div className={styles.layout}>
          <div className={styles.main}>

            {/* PERSONAL DETAILS */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Personal details</div>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label>Full name</label>
                  <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className={styles.field}>
                  <label>Phone <span className={styles.optional}>(optional)</span></label>
                  <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0400 000 000" />
                </div>
                <div className={styles.field}>
                  <label>Email</label>
                  <input className="input" value={user?.email || ''} disabled />
                  <span className={styles.hint}>Contact support to change your account email.</span>
                </div>
              </div>
              {detailsError && <div className={styles.error}>{detailsError}</div>}
              <div className={styles.saveRow}>
                {detailsSaved && <span className={styles.savedMsg}>✓ Saved</span>}
                <button className="btn-primary" onClick={handleSaveDetails} disabled={savingDetails}>
                  {savingDetails ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>

            {/* PASSWORD */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Password</div>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label>New password</label>
                  <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8+ characters" />
                </div>
                <div className={styles.field}>
                  <label>Confirm new password</label>
                  <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              {passwordError && <div className={styles.error}>{passwordError}</div>}
              <div className={styles.saveRow}>
                {passwordSaved && <span className={styles.savedMsg}>✓ Password updated</span>}
                <button className="btn-primary" onClick={handleChangePassword} disabled={savingPassword}>
                  {savingPassword ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </div>

            {/* BILLING */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Plan &amp; billing</div>
              <div className={styles.planRow}>
                <div>
                  <div className={styles.planLabel}>{planLabel}</div>
                  <div className={styles.planDetail}>{planDetail}</div>
                </div>
                {profile.stripe_customer_id ? (
                  <button className="btn-ghost" onClick={handleManageBilling} disabled={portalLoading}>
                    {portalLoading ? 'Opening…' : 'Manage billing'}
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => navigate('/pricing')}>Upgrade plan</button>
                )}
              </div>
              {billingError && <div className={styles.error}>{billingError}</div>}
              {profile.stripe_customer_id && (
                <div className={styles.sectionSub}>Update your card, view invoices, or cancel your subscription via the Stripe billing portal.</div>
              )}
            </div>

          </div>

          {/* SIDEBAR */}
          <div className={styles.sidebar}>
            <div className={styles.sideCard}>
              <div className={styles.avatarLarge}>{getInitials()}</div>
              <div className={styles.sideName}>{fullName || user?.email}</div>
              <div className={styles.sideEmail}>{user?.email}</div>
              <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
