import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Nav.module.css'

export default function Nav() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.logo}>
        Lease<em>Lens</em>
      </Link>

      <ul className={styles.links}>
        <li><a href="/#how">How it works</a></li>
        <li><a href="/#what">What you get</a></li>
        <li><a href="/#pricing">Pricing</a></li>
        <li><Link to="/privacy">Privacy</Link></li>
        {user ? (
          <>
            <li><Link to="/dashboard" className={styles.dashLink}>My documents</Link></li>
            <li><button onClick={handleSignOut} className={styles.cta}>Sign out</button></li>
          </>
        ) : (
          <>
            <li><Link to="/login" className={styles.signIn}>Sign in</Link></li>
            <li><Link to="/analyser" className={styles.cta}>Scan my document</Link></li>
          </>
        )}
      </ul>
    </nav>
  )
}