import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './AdminNav.module.css'

export default function AdminNav({ activeTab, setTab }) {
  const { signOut } = useAuth()
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
  ]

  const handleTab = (id) => {
    setTab(id)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile header bar */}
      <div className={styles.mobileHeader}>
        <div className={styles.logoWrap}>
          <svg width="20" height="20" viewBox="0 0 40 40" fill="none" style={{color:'var(--paper)'}}>
            <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
          </svg>
          <div className={styles.logo}>Lease<em>Lens</em></div>
        </div>
        <button className={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Overlay */}
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none" style={{color:'var(--paper)'}}>
              <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
            </svg>
            <div className={styles.logoWrap}>
          <svg width="20" height="20" viewBox="0 0 40 40" fill="none" style={{color:'var(--paper)'}}>
            <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
          </svg>
          <div className={styles.logo}>Lease<em>Lens</em></div>
        </div>
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
          <button className={styles.siteLink} onClick={() => navigate('/')}>← Back to site</button>
          <button className={styles.signOut} onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>
    </>
  )
}
