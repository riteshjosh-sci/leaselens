import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import styles from './Nav.module.css'

export default function Nav() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('full_name, plan')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [user])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  // Derive initials from full_name or email
  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  // Plan label
  const getPlanLabel = () => {
    const map = {
      free:     'Free plan',
      one_off:  'One-off',
      monthly:  'Professional · unlimited scans',
      annual:   'Professional · unlimited scans',
      adviser:  'Adviser',
    }
    return map[profile?.plan] || 'Free plan'
  }

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.inner}>

          {/* Logo */}
          <div className={styles.left}>
            <Link to="/" className={styles.logo}>
              <svg className={styles.mark} width="24" height="24" viewBox="0 0 40 40" fill="none">
                <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
                <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
              </svg>
              <span className={styles.wordmark}>Lease<span className={styles.lens}>Room</span></span>
            </Link>

            {/* Desktop nav links — different for logged in vs out */}
            {user ? (
              <ul className={styles.links}>
                <li>
                  <Link to="/dashboard" className={isActive('/dashboard') ? styles.active : ''}>
                    Dashboard
                  </Link>
                </li>
              </ul>
            ) : (
              <ul className={styles.links}>
                <li><Link to="/#how-it-works">How it works</Link></li>
                <li><Link to="/#what-you-get">What you get</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
                <li><Link to="/privacy">Privacy</Link></li>
              </ul>
            )}
          </div>

          {/* Right side */}
          {user ? (
            <div className={styles.right}>
              <button
                className={styles.themeToggle}
                onClick={toggleTheme}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {theme === 'dark' ? '☀' : '☾'}
              </button>
              <span className={styles.credits}>
                <b>{getPlanLabel()}</b>
              </span>
              <div className={styles.avatarWrap}>
                <div
                  className={styles.avatar}
                  onClick={() => setAvatarMenuOpen(o => !o)}
                  title="Account"
                >
                  {getInitials()}
                </div>
                {avatarMenuOpen && (
                  <>
                    <div className={styles.avatarMenuBackdrop} onClick={() => setAvatarMenuOpen(false)} />
                    <div className={styles.avatarMenu}>
                      <button onClick={() => { setAvatarMenuOpen(false); navigate('/profile') }}>Profile</button>
                      <button onClick={() => { setAvatarMenuOpen(false); navigate('/dashboard') }}>Dashboard</button>
                      <div className={styles.avatarMenuDivider} />
                      <button onClick={handleSignOut}>Sign out</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.cta}>
              <button
                className={styles.themeToggle}
                onClick={toggleTheme}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {theme === 'dark' ? '☀' : '☾'}
              </button>
              <Link to="/login" className={styles.signIn}>Sign in</Link>
              <Link to="/signup" className="btn-primary btn-sm">Get started</Link>
            </div>
          )}

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
            <button onClick={toggleTheme} className={styles.mobileThemeToggle}>
              {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
            </button>
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
                <div className={styles.mobileDivider} />
                <button onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
                <Link to="/#what-you-get" onClick={() => setMenuOpen(false)}>What you get</Link>
                <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
                <Link to="/privacy" onClick={() => setMenuOpen(false)}>Privacy</Link>
                <div className={styles.mobileDivider} />
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
