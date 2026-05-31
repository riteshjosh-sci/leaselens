import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './AdminNav.module.css'

export default function AdminNav({ activeTab, setTab }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const tabs = [
    { id: 'overview',   label: 'Overview',   icon: '▦' },
    { id: 'users',      label: 'Users',      icon: '◉' },
    { id: 'documents',  label: 'Documents',  icon: '◈' },
    { id: 'reports',    label: 'Reports',    icon: '◎' },
    { id: 'beta',       label: 'Beta codes', icon: '◆' },
    { id: 'waitlist',   label: 'Waitlist',   icon: '◇' },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>Lease<em>Lens</em></div>
        <div className={styles.adminTag}>Admin panel</div>
      </div>
      <nav className={styles.nav}>
        {tabs.map(t => (
          <button key={t.id} className={`${styles.navItem} ${activeTab === t.id ? styles.active : ''}`} onClick={() => setTab(t.id)}>
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
  )
}