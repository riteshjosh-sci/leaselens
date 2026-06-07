import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Nav.module.css'

export default function Nav() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const close = () => setMenuOpen(false)

  return (
    <>
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>
          Lease<em>Lens</em>
        </Link>

        {/* Desktop links */}
        <ul className={styles.links}>
          <li><a href="/#how">How it works</a></li>
          <li><a href="/#what">What you get</a></li>
          <li><a href="/#pricing">Pricing</a></li>
          <li><Link to="/privacy">Privacy</Link></li>
          {user ? (
            <>
              <li><Link to="/dashboard" className={styles.dashLink}>Dashboard</Link></li>
              <li><button onClick={handleSignOut} className={styles.cta}>Sign out</button></li>
            </>
          ) : (
            <>
              <li><Link to="/login" className={styles.signIn}>Sign in</Link></li>
              <li><Link to="/analyser" className={styles.cta}>Scan my document</Link></li>
            </>
          )}
        </ul>

        {/* Mobile hamburger */}
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.bar} ${menuOpen ? styles.barTop : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barMid : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barBot : ''}`} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          <a href="/#how" onClick={close}>How it works</a>
          <a href="/#what" onClick={close}>What you get</a>
          <a href="/#pricing" onClick={close}>Pricing</a>
          <Link to="/privacy" onClick={close}>Privacy</Link>
          <div className={styles.mobileDivider} />
          {user ? (
            <>
              <Link to="/dashboard" onClick={close}>My documents</Link>
              <button onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={close}>Sign in</Link>
              <Link to="/analyser" onClick={close} className={styles.mobileCta}>Scan my document</Link>
            </>
          )}
        </div>
      )}
    </>
  )
}
