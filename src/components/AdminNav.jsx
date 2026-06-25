import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import styles from './AdminNav.module.css'
import leaseroomLogoLight from '../assets/leaseroom-logo-light.png'

export default function AdminNav({ activeTab, setTab }) {
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const tabs = [
    { id: 'overview',    label: 'Overview',    icon: '▦' },
    { id: 'users',       label: 'Users',       icon: '◉' },
    { id: 'workspaces',  label: 'Workspaces',  icon: '◫' },
    { id: 'documents',   label: 'Documents',   icon: '◈' },
    { id: 'reports',     label: 'Reports',     icon: '◎' },
    { id: 'beta',        label: 'Beta codes',  icon: '◆' },
    { id: 'waitlist',    label: 'Waitlist',    icon: '◇' },
    { id: 'feedback',    label: 'Feedback',    icon: '◐' },
  ]

  const handleTab = (id) => {
    setTab(id)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile header bar */}
      <div className={styles.mobileHeader}>
        <img src={leaseroomLogoLight} alt="LeaseRoom" className={styles.logoImgMobile} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className={styles.hamburger} onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme" style={{ fontSize: 16 }}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Overlay */}
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <img src={leaseroomLogoLight} alt="LeaseRoom" className={styles.logoImg} />
          </div>
          <div className={styles.adminTag}>Admin panel</div>
        </div>
        <nav className={styles.nav}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`${styles.navItem} ${activeTab === t.id ? styles.active : ''}`}
              onClick={() => handleTab(t.id)}
            >
              <span className={styles.navIcon}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className={styles.bottom}>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
          </button>
          <button className={styles.siteLink} onClick={() => navigate('/')}>← Back to site</button>
          <button className={styles.signOut} onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>
    </>
  )
}