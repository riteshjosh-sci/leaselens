import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none" style={{color:'var(--accent-lt)'}}>
              <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
            </svg>
            <span className={styles.wordmark}>Lease<span className={styles.lens}>Lens</span></span>
          </div>
          <p className={styles.blurb}>Built for Australian retail tenants.</p>
        </div>
        <ul className={styles.links}>
          <li><Link to="/pricing">Pricing</Link></li>
          <li><Link to="/privacy">Privacy</Link></li>
          <li><Link to="/terms">Terms</Link></li>
          <li><Link to="/contact">Contact</Link></li>
        </ul>
        <div className={styles.copy}>© 2026 LeaseLens · Built for Australian retail tenants</div>
      </div>
    </footer>
  )
}