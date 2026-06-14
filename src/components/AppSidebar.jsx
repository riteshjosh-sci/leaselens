import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './AppSidebar.module.css'

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',    path: '/dashboard',  icon: <GridIcon /> },
  { id: 'analyser',    label: 'Analyse',       path: '/analyser',   icon: <ScanIcon /> },
  { id: 'workspaces',  label: 'Workspaces',   path: '/dashboard',  icon: <FolderIcon /> },
  { id: 'reports',     label: 'Reports',       path: '/dashboard',  icon: <FileIcon /> },
  { id: 'compare',     label: 'Compare',       path: '/dashboard',  icon: <CompareIcon /> },
]

function GridIcon()   { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg> }
function ScanIcon()   { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M4 7V4.5A.5.5 0 0 1 4.5 4H7M13 4h2.5a.5.5 0 0 1 .5.5V7M16 13v2.5a.5.5 0 0 1-.5.5H13M7 16H4.5a.5.5 0 0 1-.5-.5V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6"/></svg> }
function FolderIcon() { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M2 6a2 2 0 0 1 2-2h3.5l2 2H16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="1.6"/></svg> }
function FileIcon()   { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> }
function CompareIcon(){ return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M4 10h8M4 14h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 8l3 2-3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function SignOutIcon(){ return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M13 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M8 14l4-4-4-4M12 10H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function SettingsIcon(){ return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }

export default function AppSidebar({ mobileOpen, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('plan, scan_credits, monthly_scans_used').eq('id', user.id).single()
      .then(({ data }) => setProfile(data))
  }, [user])

  const planLabel = {
    free: 'Free plan',
    one_off: 'One-off',
    monthly: 'Monthly plan',
    annual: 'Annual plan',
    adviser: 'Adviser plan',
  }[profile?.plan || 'free'] || 'Free plan'

  const isPaid = profile?.plan && profile.plan !== 'free'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleNav = (path) => {
    navigate(path)
    onClose?.()
  }

  const isActive = (id) => {
    if (id === 'dashboard') return location.pathname === '/dashboard'
    if (id === 'analyser') return location.pathname === '/analyser'
    if (id === 'workspaces') return location.pathname.startsWith('/workspace/') || location.pathname.startsWith('/negotiation/')
    if (id === 'reports') return location.pathname.startsWith('/report/')
    if (id === 'compare') return location.pathname.startsWith('/compare/')
    return false
  }

  return (
    <>
      {mobileOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>

        {/* Logo */}
        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
              <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="5.4" fill="white"/>
            </svg>
          </div>
          <div>
            <div className={styles.logoText}>Lease<span className={styles.logoAccent}>Lens</span></div>
            <div className={styles.logoSub}>Legal Intelligence</div>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <div className={styles.navLabel}>Menu</div>
            {NAV.map(item => (
              <button
                key={item.id}
                className={`${styles.navItem} ${isActive(item.id) ? styles.navActive : ''}`}
                onClick={() => handleNav(item.path)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navText}>{item.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.navSection}>
            <div className={styles.navLabel}>Account</div>
            <button className={styles.navItem} onClick={() => handleNav('/settings')}>
              <span className={styles.navIcon}><SettingsIcon /></span>
              <span className={styles.navText}>Settings</span>
            </button>
          </div>
        </nav>

        {/* Upgrade card — only show on free plan */}
        {!isPaid && (
          <div className={styles.upgradeCard}>
            <div className={styles.upgradeIcon}>✦</div>
            <div className={styles.upgradeTitle}>Upgrade to Pro</div>
            <div className={styles.upgradeSub}>Unlimited scans, branded reports & more.</div>
            <button className={styles.upgradeBtn} onClick={() => handleNav('/pricing')}>
              Upgrade now
            </button>
          </div>
        )}

        {/* Bottom */}
        <div className={styles.bottom}>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{user?.email?.[0]?.toUpperCase()}</div>
            <div className={styles.userInfo}>
              <div className={styles.userEmail}>{user?.email}</div>
              <div className={styles.userPlan}>{planLabel}</div>
            </div>
          </div>
          <button className={styles.signOut} onClick={handleSignOut}>
            <SignOutIcon /> Sign out
          </button>
        </div>

      </aside>
    </>
  )
}