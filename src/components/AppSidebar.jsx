import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { PLANS } from '../lib/stripe'
import styles from './AppSidebar.module.css'
import leaseroomLogoDark from '../assets/leaseroom-logo-dark.png'
import leaseroomLogoLight from '../assets/leaseroom-logo-light.png'

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Home',         icon: '⌂', match: ['/dashboard'] },
  { to: '/properties',   label: 'Properties',   icon: '▭', match: ['/properties', '/workspace'] },
  { to: '/negotiations', label: 'Negotiations', icon: '⇄', match: ['/negotiations', '/negotiation'] },
]

export default function AppSidebar({ children }) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const logoSrc = theme === 'dark' ? leaseroomLogoLight : leaseroomLogoDark

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('full_name, plan, free_scans_used, monthly_scans_used, scan_credits, founding_member, stripe_customer_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [user])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const planInfo = () => {
    const plan = profile?.plan || 'free'
    if (plan === 'free')    return { label: 'Free', detail: `${profile?.free_scans_used || 0} / 1 scan used` }
    if (plan === 'one_off') return { label: 'One-off', detail: `${profile?.scan_credits || 0} credit${profile?.scan_credits === 1 ? '' : 's'} remaining` }
    if (plan === 'monthly' || plan === 'annual') return { label: PLANS[plan]?.name || plan, detail: `${profile?.monthly_scans_used || 0} / 10 scans used this month` }
    if (plan === 'adviser') return { label: 'Professional', detail: `${profile?.monthly_scans_used || 0} / ∞ scans this month` }
    return { label: plan, detail: '' }
  }

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  const isActive = (matches) => matches.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))

  const handleNavClick = (to) => {
    navigate(to)
    setMobileOpen(false)
  }

  return (
    <div className={styles.shell}>
      {/* Mobile header bar */}
      <div className={styles.mobileHeader}>
        <button className={styles.logoBtnMobile} onClick={() => handleNavClick('/')} aria-label="Go to public site">
          <img src={logoSrc} alt="LeaseRoom" className={styles.logoImgMobile} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className={styles.hamburger} onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className={styles.hamburger} onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Overlay */}
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <button className={styles.brand} onClick={() => handleNavClick('/')} aria-label="Go to public site">
          <img src={logoSrc} alt="LeaseRoom" className={styles.logoImg} />
        </button>

        <button className={styles.analyseBtn} data-tour="analyse-btn" onClick={() => handleNavClick('/analyser')}>
          + Analyse document
        </button>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.to}
              className={`${styles.navItem} ${isActive(item.match) ? styles.active : ''}`}
              onClick={() => handleNavClick(item.to)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.planCard}>
          <div className={styles.planCardHead}>
            <span className={`${styles.planCardLabel} ${profile?.plan === 'adviser' ? styles.planCardLabelPro : ''}`}>
              {profile?.plan === 'adviser' && <span className={styles.proStar}>★</span>}
              {planInfo().label}
            </span>
            {profile?.founding_member && <span className={styles.foundingBadge}>★ Founding</span>}
          </div>
          <div className={styles.planCardDetail}>{planInfo().detail}</div>
          {profile?.plan !== 'adviser' && (
            <button className={styles.planCardUpgrade} onClick={() => handleNavClick('/pricing')}>
              Upgrade plan →
            </button>
          )}
        </div>

        <div className={styles.bottom}>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
          </button>
          <div className={styles.userRow}>
            <div className={styles.userAvatar}>{getInitials()}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{profile?.full_name || user?.email}</div>
              <button className={styles.userSettings} onClick={() => handleNavClick('/profile')}>Settings</button>
            </div>
          </div>
          <button className={styles.signOut} onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  )
}
