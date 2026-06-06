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
        <div className={styles.logo}>Lease<em>Lens</em></div>
        <button className={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Overlay */}
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <div className={styles.logo}>Lease<em>Lens</em></div>
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
