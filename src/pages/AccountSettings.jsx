import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './AccountSettings.module.css'

const MenuIcon   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const CheckIcon  = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const UserIcon   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6"/><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const LockIcon   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const BellIcon   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6zM8 16a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const ShieldIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5l-7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
const TrashIcon  = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4h4v2M7 9v6M13 9v6M5 6l1 10h8l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const CrownIcon  = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 14h14M4 14L2 6l4 4 4-6 4 6 4-4-2 8H4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>

const TABS = [
  { id: 'profile',       label: 'Profile',        icon: <UserIcon /> },
  { id: 'security',      label: 'Security',        icon: <LockIcon /> },
  { id: 'notifications', label: 'Notifications',   icon: <BellIcon /> },
  { id: 'plan',          label: 'Plan & Billing',  icon: <CrownIcon /> },
  { id: 'danger',        label: 'Danger zone',     icon: <ShieldIcon /> },
]

const PLAN_LABELS = { free:'Free', one_off:'One-off', monthly:'Monthly', annual:'Annual', adviser:'Adviser' }
const PLAN_COLORS = { free:'var(--navy-muted)', one_off:'var(--accent)', monthly:'var(--risk-l)', annual:'var(--risk-l)', adviser:'var(--gold)' }

export default function AccountSettings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState('')
  const [error, setError]       = useState('')
  const [activeTab, setActiveTab] = useState('profile')
  const [mobileOpen, setMobileOpen] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [company, setCompany]   = useState('')
  const [phone, setPhone]       = useState('')

  // Password fields
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passError, setPassError]     = useState('')

  // Notifications
  const [notifAnalysis, setNotifAnalysis]   = useState(true)
  const [notifWeekly, setNotifWeekly]       = useState(false)
  const [notifMarketing, setNotifMarketing] = useState(false)

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => { if (!user) { navigate('/login'); return }; fetchProfile() }, [user])

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles')
      .select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setFullName(data.full_name || '')
      setCompany(data.company || '')
      setPhone(data.phone || '')
      setNotifAnalysis(data.notif_analysis ?? true)
      setNotifWeekly(data.notif_weekly ?? false)
      setNotifMarketing(data.notif_marketing ?? false)
    }
    setLoading(false)
  }

  const handleSaveProfile = async () => {
    setSaving(true); setError(''); setSaved('')
    const { error: err } = await supabase.from('profiles').upsert({
      id: user.id, full_name: fullName.trim() || null,
      company: company.trim() || null, phone: phone.trim() || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSaved('profile'); setSaving(false)
    setTimeout(() => setSaved(''), 2500)
  }

  const handleChangePassword = async () => {
    setPassError('')
    if (!newPass || newPass.length < 8) { setPassError('Password must be at least 8 characters.'); return }
    if (newPass !== confirmPass) { setPassError('Passwords do not match.'); return }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPass })
    if (err) { setPassError(err.message); setSaving(false); return }
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
    setSaved('password'); setSaving(false)
    setTimeout(() => setSaved(''), 2500)
  }

  const handleSaveNotifs = async () => {
    setSaving(true)
    await supabase.from('profiles').upsert({
      id: user.id, notif_analysis: notifAnalysis, notif_weekly: notifWeekly, notif_marketing: notifMarketing,
    })
    setSaved('notifs'); setSaving(false)
    setTimeout(() => setSaved(''), 2500)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) { setError('Email does not match.'); return }
    await supabase.auth.admin.deleteUser(user.id)
    await signOut()
    navigate('/')
  }

  const formatDate = d => d ? new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' }) : '—'

  if (loading) return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main"><div className={styles.loading}><div className={styles.ring} /></div></main>
    </div>
  )

  return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main">

        {/* TOP BAR */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}><MenuIcon /></button>
            <div>
              <div className={styles.crumb}>
                <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                <span>›</span><span>Account settings</span>
              </div>
              <h1 className={styles.h1}>Account settings</h1>
              <p className={styles.sub}>{user?.email}</p>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.planBadge} style={{color: PLAN_COLORS[profile?.plan || 'free']}}>
              <CrownIcon />
              {PLAN_LABELS[profile?.plan || 'free']} plan
            </div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.layout}>

            {/* LEFT — tab nav */}
            <div className={styles.tabNav}>
              {TABS.map(t => (
                <button key={t.id}
                  className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(t.id)}>
                  <span className={styles.tabIcon}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* RIGHT — content */}
            <div className={styles.main}>

              {/* ── PROFILE ── */}
              {activeTab === 'profile' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle}>Profile information</h2>
                    <p className={styles.sSub}>Your personal details and contact information.</p>
                  </div>

                  {/* Avatar */}
                  <div className={styles.avatarRow}>
                    <div className={styles.avatar}>{user?.email?.[0]?.toUpperCase()}</div>
                    <div>
                      <div className={styles.avatarName}>{fullName || user?.email?.split('@')[0]}</div>
                      <div className={styles.avatarEmail}>{user?.email}</div>
                      <div className={styles.avatarMeta}>Member since {formatDate(user?.created_at)}</div>
                    </div>
                  </div>

                  <div className={styles.fields}>
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label>Full name</label>
                        <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                      </div>
                      <div className={styles.field}>
                        <label>Company <span className={styles.opt}>(optional)</span></label>
                        <input className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Your company" />
                      </div>
                    </div>
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label>Email address</label>
                        <input className="input" value={user?.email} disabled style={{opacity:0.6}} />
                        <span className={styles.fieldNote}>Contact support to change your email.</span>
                      </div>
                      <div className={styles.field}>
                        <label>Phone <span className={styles.opt}>(optional)</span></label>
                        <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+61 4xx xxx xxx" />
                      </div>
                    </div>
                  </div>

                  {error && <div className={styles.errorBox}>{error}</div>}
                  <div className={styles.saveRow}>
                    <button className="btn-gold" onClick={handleSaveProfile} disabled={saving}>
                      {saved === 'profile' ? <><CheckIcon /> Saved</> : 'Save profile'}
                    </button>
                    {saved === 'profile' && <span className={styles.savedMsg}>Profile updated successfully</span>}
                  </div>
                </div>
              )}

              {/* ── SECURITY ── */}
              {activeTab === 'security' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle}>Security</h2>
                    <p className={styles.sSub}>Manage your password and account security.</p>
                  </div>

                  <div className={styles.fields}>
                    <div className={styles.field}>
                      <label>New password</label>
                      <input className="input" type="password" value={newPass}
                        onChange={e => setNewPass(e.target.value)} placeholder="At least 8 characters" />
                    </div>
                    <div className={styles.field}>
                      <label>Confirm new password</label>
                      <input className="input" type="password" value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)} placeholder="Repeat new password" />
                    </div>
                  </div>

                  {passError && <div className={styles.errorBox}>{passError}</div>}
                  <div className={styles.saveRow}>
                    <button className="btn-gold" onClick={handleChangePassword} disabled={saving || !newPass}>
                      {saved === 'password' ? <><CheckIcon /> Password changed</> : 'Change password'}
                    </button>
                  </div>

                  {/* Session info */}
                  <div className={styles.secInfo}>
                    <h3 className={styles.secTitle}>Session information</h3>
                    <div className={styles.secRows}>
                      <div className={styles.secRow}>
                        <span className={styles.secLabel}>Last sign in</span>
                        <span className={styles.secVal}>{formatDate(user?.last_sign_in_at)}</span>
                      </div>
                      <div className={styles.secRow}>
                        <span className={styles.secLabel}>Account created</span>
                        <span className={styles.secVal}>{formatDate(user?.created_at)}</span>
                      </div>
                      <div className={styles.secRow}>
                        <span className={styles.secLabel}>Auth provider</span>
                        <span className={styles.secVal}>{user?.app_metadata?.provider || 'Email'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── NOTIFICATIONS ── */}
              {activeTab === 'notifications' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle}>Notifications</h2>
                    <p className={styles.sSub}>Choose what you want to be notified about.</p>
                  </div>
                  <div className={styles.toggleList}>
                    {[
                      { label:'Analysis complete', sub:'Get notified when your document analysis is ready.', val:notifAnalysis, set:setNotifAnalysis },
                      { label:'Weekly summary', sub:'A weekly digest of your negotiation activity.', val:notifWeekly, set:setNotifWeekly },
                      { label:'Product updates', sub:'Tips, new features and LeaseLens news.', val:notifMarketing, set:setNotifMarketing },
                    ].map((n, i) => (
                      <div key={i} className={styles.toggleRow}>
                        <div className={styles.toggleInfo}>
                          <div className={styles.toggleLabel}>{n.label}</div>
                          <div className={styles.toggleSub}>{n.sub}</div>
                        </div>
                        <button className={`${styles.toggle} ${n.val ? styles.toggleOn : ''}`}
                          onClick={() => n.set(!n.val)}>
                          <span className={styles.toggleKnob} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={styles.saveRow}>
                    <button className="btn-gold" onClick={handleSaveNotifs} disabled={saving}>
                      {saved === 'notifs' ? <><CheckIcon /> Saved</> : 'Save preferences'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── PLAN & BILLING ── */}
              {activeTab === 'plan' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle}>Plan & Billing</h2>
                    <p className={styles.sSub}>Manage your subscription and payment details.</p>
                  </div>
                  <div className={styles.planCard}>
                    <div className={styles.planLeft}>
                      <div className={styles.planIcon}><CrownIcon /></div>
                      <div>
                        <div className={styles.planName}>{PLAN_LABELS[profile?.plan || 'free']} plan</div>
                        <div className={styles.planDesc}>
                          {profile?.plan === 'free' ? 'Limited to 1 free scan. Upgrade for unlimited access.'
                           : profile?.plan === 'adviser' ? 'Unlimited scans, multiple client workspaces, branded reports.'
                           : profile?.plan === 'monthly' ? 'Unlimited scans, billed monthly.'
                           : 'Unlimited scans, billed annually. Save 20%.'}
                        </div>
                      </div>
                    </div>
                    <div className={styles.planRight}>
                      {profile?.plan === 'free'
                        ? <button className="btn-gold" onClick={() => navigate('/pricing')}>Upgrade plan</button>
                        : <button className="btn-outline btn-sm" onClick={() => navigate('/pricing')}>Manage plan</button>
                      }
                    </div>
                  </div>

                  {profile?.plan === 'free' && (
                    <div className={styles.upgradePrompt}>
                      <h3>Unlock the full power of LeaseLens</h3>
                      <div className={styles.upgradeFeatures}>
                        {['Unlimited document analyses','Client-ready branded reports','Version comparison','Priority support'].map((f,i) => (
                          <div key={i} className={styles.upgradeFeature}>
                            <span className={styles.ufCheck}><CheckIcon /></span>{f}
                          </div>
                        ))}
                      </div>
                      <button className="btn-gold" onClick={() => navigate('/pricing')}>View plans →</button>
                    </div>
                  )}

                  <div className={styles.billingInfo}>
                    <h3 className={styles.secTitle}>Account details</h3>
                    <div className={styles.secRows}>
                      <div className={styles.secRow}>
                        <span className={styles.secLabel}>Current plan</span>
                        <span className={styles.secVal} style={{color: PLAN_COLORS[profile?.plan||'free'], fontWeight:700}}>
                          {PLAN_LABELS[profile?.plan || 'free']}
                        </span>
                      </div>
                      <div className={styles.secRow}>
                        <span className={styles.secLabel}>Scans used</span>
                        <span className={styles.secVal}>{profile?.monthly_scans_used || 0} this month</span>
                      </div>
                      <div className={styles.secRow}>
                        <span className={styles.secLabel}>Member since</span>
                        <span className={styles.secVal}>{formatDate(user?.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── DANGER ZONE ── */}
              {activeTab === 'danger' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle} style={{color:'var(--risk-h)'}}>Danger zone</h2>
                    <p className={styles.sSub}>These actions are permanent and cannot be undone.</p>
                  </div>
                  <div className={styles.dangerList}>
                    <div className={styles.dangerItem}>
                      <div>
                        <div className={styles.dangerTitle}>Delete all documents</div>
                        <div className={styles.dangerSub}>Permanently delete all uploaded documents and their analyses. Your account remains active.</div>
                      </div>
                      <button className={styles.dangerBtn}>Delete all documents</button>
                    </div>
                    <div className={`${styles.dangerItem} ${styles.dangerItemRed}`}>
                      <div>
                        <div className={styles.dangerTitle}>Delete account</div>
                        <div className={styles.dangerSub}>Permanently delete your account and all data. This cannot be undone.</div>
                      </div>
                      <div className={styles.deleteConfirmWrap}>
                        <input className="input" placeholder={`Type "${user?.email}" to confirm`}
                          value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} />
                        <button className={styles.dangerBtnRed}
                          disabled={deleteConfirm !== user?.email}
                          onClick={handleDeleteAccount}>
                          <TrashIcon /> Delete account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
