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
        <div className={styles.meta}>leaseroom.com.au/privacy · 16 June 2026</div>

        <div className={styles.notice}>
          This Privacy Policy has been prepared for legal review ahead of launch. A solicitor review summary covering the key questions requiring a legal opinion is being finalised separately before the service takes paying customers.
        </div>

        <h2>1. About this policy</h2>
        <p>LeaseRoom is operated by Plank Studio Pty Ltd (ACN 684 753 731, ABN 37 684 753 731) ("we", "us", "our"). We operate the website at leaseroom.com.au and the document analysis service available through it.</p>
        <p>This Privacy Policy explains how we collect, use, store and share personal information. We are committed to protecting your privacy and handling your information responsibly in accordance with applicable Australian law.</p>
        <p>By using our service, you agree to the collection and use of information in accordance with this policy.</p>

        <h2>2. What information we collect</h2>
        <h3>Information you provide</h3>
        <ul>
          <li>Your name and email address when you create an account</li>
          <li>Payment information, which is processed by Stripe on our behalf. We do not store your card details</li>
          <li>Documents you upload for analysis. These may contain personal information relating to you and third parties including landlords, agents, and guarantors</li>
          <li>Any communications you send us</li>
        </ul>
        <h3>Information collected automatically</h3>
        <ul>
          <li>Usage data including pages visited and features used</li>
          <li>Device and browser information</li>
          <li>IP address</li>
        </ul>

        <h2>3. How we use your information</h2>
        <p>We use the information we collect to provide and improve our service, manage your account, process payments, and communicate with you about your account.</p>
        <p>When you submit a document for analysis, anonymised clause data may be used to improve the accuracy of future analyses. No personally identifying information including names, addresses, or financial details is retained for this purpose. You are notified of this at the point of submission.</p>

        <h2>4. Sharing your information</h2>
        <p>We do not sell your personal information. We share information with the following third parties only to the extent necessary to provide our service:</p>
        <h3>Anthropic</h3>
        <p>Documents you upload are transmitted to Anthropic PBC for AI analysis. Anthropic processes your document to generate the analysis report. Anthropic states that data submitted via their API is not used to train their models. Their privacy policy is available at anthropic.com/privacy.</p>
        <h3>Stripe</h3>
        <p>Payments are processed by Stripe Inc in accordance with PCI-DSS standards. We do not store card details. Stripe's privacy policy is available at stripe.com/au/privacy.</p>
        <h3>Supabase</h3>
        <p>User account data and document history are stored with Supabase, hosted in Australian data centres (ap-southeast-2).</p>
        <h3>Legal requirements</h3>
        <p>In addition to the disclosures above, we may disclose your information where required by law or in response to a valid request from a government authority.</p>

        <h2>5. Data retention</h2>
        <p>We retain your account information and document history for as long as your account remains active. You may request deletion of your account and associated data at any time by contacting us. Anonymised clause data retained for service improvement does not contain personally identifying information.</p>

        <h2>6. Security</h2>
        <p>We take reasonable steps to protect your information including TLS-encrypted transmission, secure Australian cloud storage, server-side API key management, and row-level database security controls. No method of internet transmission is completely secure and we cannot guarantee absolute security.</p>

        <h2>7. Your rights</h2>
        <p>You have the right to request access to, correction of, or deletion of your personal information. You may also withdraw consent to the use of anonymised clause data for service improvement purposes. To exercise any of these rights contact us at <a href="mailto:hello@leaseroom.com.au">hello@leaseroom.com.au</a>.</p>
        <p>If you are not satisfied with our handling of a privacy concern you may contact the Office of the Australian Information Commissioner at <a href="https://oaic.gov.au" target="_blank" rel="noopener noreferrer">oaic.gov.au</a>.</p>

        <h2>8. Cookies</h2>
        <p>LeaseRoom uses only essential cookies required for the service to function including session management and authentication. We do not use tracking or advertising cookies.</p>

        <h2>9. Changes to this policy</h2>
        <p>We may update this policy from time to time. We will notify users of material changes by email or by notice on the website. Continued use of the service following notification constitutes acceptance of the updated policy.</p>

        <h2>10. Contact</h2>
        <div className={styles.contactBlock}>
          <strong>Entity:</strong> Plank Studio Pty Ltd, trading as LeaseRoom<br />
          ACN 684 753 731 &nbsp;|&nbsp; ABN 37 684 753 731<br />
          Email: <a href="mailto:hello@leaseroom.com.au">hello@leaseroom.com.au</a><br />
          Website: <a href="https://www.leaseroom.com.au" target="_blank" rel="noopener noreferrer">www.leaseroom.com.au</a>
        </div>
      </main>
      <Footer />
    </>
  )
}
