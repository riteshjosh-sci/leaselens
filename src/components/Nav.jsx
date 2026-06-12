import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './Nav.module.css'

export default function Nav() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.inner}>
          {/* Logo */}
          <Link to="/" className={styles.logo}>
            <svg className={styles.mark} width="24" height="24" viewBox="0 0 40 40" fill="none">
              <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
            </svg>
            <span className={styles.wordmark}>Lease<span className={styles.lens}>Lens</span></span>
          </Link>

          {/* Desktop links */}
          <ul className={styles.links}>
            <li><Link to="/#how-it-works">How it works</Link></li>
            <li><Link to="/#what-you-get">What you get</Link></li>
            <li><Link to="/pricing">Pricing</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
          </ul>

          {/* Desktop CTA */}
          <div className={styles.cta}>
            {user ? (
              <>
                <Link to="/dashboard" className={styles.dashLink}>Dashboard</Link>
                <button className="btn-ink btn-sm" onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className={styles.signIn}>Sign in</Link>
                <Link to="/signup" className="btn-primary btn-sm">Get started</Link>
              </>
            )}
          </div>

          {/* Hamburger */}
          <button
            className={styles.burger}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span className={menuOpen ? styles.barTopOpen : ''} />
            <span className={menuOpen ? styles.barMidOpen : ''} />
            <span className={menuOpen ? styles.barBotOpen : ''} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className={styles.mobileMenu}>
            <Link to="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
            <Link to="/#what-you-get" onClick={() => setMenuOpen(false)}>What you get</Link>
            <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <Link to="/privacy" onClick={() => setMenuOpen(false)}>Privacy</Link>
            <div className={styles.mobileDivider} />
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link to="/signup" className={styles.mobileCta} onClick={() => setMenuOpen(false)}>Get started →</Link>
              </>
            )}
          </div>
        )}
      </nav>
    </>
  )
}