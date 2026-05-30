import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Legal.module.css'

export default function Privacy() {
  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.kicker}>Legal</div>
        <h1 className={styles.h1}>Privacy Policy</h1>
        <div className={styles.meta}>Last updated: May 2026 — Version 1.0</div>

        <div className={styles.notice}>
          This Privacy Policy is provided as a working draft for legal review. It has not yet been reviewed by a qualified Australian solicitor.
        </div>

        <h2>1. About this policy</h2>
        <p>LeaseLens operates the website at leaselens.au and the document analysis service available through it. This Privacy Policy explains how we collect, use, store and disclose personal information in connection with our services, in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles.</p>

        <h2>2. What information we collect</h2>
        <h3>Information you provide directly</h3>
        <ul>
          <li>Your name and email address when you create an account</li>
          <li>Payment information processed through Stripe (we do not store card details)</li>
          <li>Documents you upload for analysis, which may contain personal information</li>
        </ul>
        <h3>Information collected automatically</h3>
        <ul>
          <li>Basic usage data including pages visited and features used</li>
          <li>Browser type, device type, and IP address</li>
        </ul>

        <h2>3. How we use your information</h2>
        <p>We use the information we collect to provide the document analysis service, maintain your account, process payments, and improve analysis quality. When you submit a document, anonymised clause data may be used to improve our knowledge base. No personally identifying information is retained for this purpose.</p>

        <h2>4. How we share your information</h2>
        <p>We do not sell your personal information. We share it only with: Anthropic (AI processing), Stripe (payment processing), and Supabase (data storage). Full details are in our complete privacy policy.</p>

        <h2>5. Security</h2>
        <p>All data is transmitted via TLS encryption. API keys are stored as server-side environment variables. Row-level security policies ensure users can only access their own data.</p>

        <h2>6. Your rights</h2>
        <p>You may request access, correction, or deletion of your personal data at any time by contacting us at <a href="mailto:hello@leaselens.au">hello@leaselens.au</a>.</p>

        <h2>7. Contact</h2>
        <p>For privacy enquiries: <a href="mailto:hello@leaselens.au">hello@leaselens.au</a> · leaselens.au</p>
      </main>
      <Footer />
    </>
  )
}
