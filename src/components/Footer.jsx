import { Link } from 'react-router-dom'
import styles from './Footer.module.css'
import leaseroomLogoLight from '../assets/leaseroom-logo-light.png'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <img src={leaseroomLogoLight} alt="LeaseRoom" className={styles.logoImg} />
          </div>
          <p className={styles.blurb}>Built for Australian retail tenants.</p>
        </div>
        <ul className={styles.links}>
          <li><Link to="/pricing">Pricing</Link></li>
          <li><Link to="/privacy">Privacy</Link></li>
          <li><Link to="/terms">Terms</Link></li>
          <li><Link to="/contact">Contact</Link></li>
        </ul>
        <div className={styles.copy}>© 2026 LeaseRoom · Built for Australian retail tenants</div>
      </div>
    </footer>
  )
}