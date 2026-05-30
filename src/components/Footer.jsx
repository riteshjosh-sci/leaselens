import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.logo}>Lease<em>Lens</em></div>
        <ul className={styles.links}>
          <li><a href="/#how">How it works</a></li>
          <li><a href="/#pricing">Pricing</a></li>
          <li><Link to="/privacy">Privacy</Link></li>
          <li><Link to="/terms">Terms</Link></li>
          <li><a href="mailto:hello@leaselens.au">Contact</a></li>
        </ul>
        <div className={styles.copy}>© 2026 LeaseLens · Built for Australian retail tenants</div>
      </div>
    </footer>
  )
}
