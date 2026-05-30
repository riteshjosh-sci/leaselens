import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()

  return (
    <>
      <Nav />

      {/* HERO */}
      <section className={styles.heroWrap}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.kicker}>
              <span className={styles.kickerLine} />
              Lease intelligence for retail tenants
            </div>
            <h1 className={styles.h1}>
              Level the playing field.<br /><em>An expert in your corner.</em>
            </h1>
            <p className={styles.heroSub}>
              Guidance throughout the lease negotiation process for retailers. LeaseLens gives you the clarity on how to structure your retail lease to give your business the best chance of success.
            </p>
            <div className={styles.heroActions}>
              <button className="btn-primary" onClick={() => navigate('/analyser')}>
                Scan my document →
              </button>
              <a href="#how" className="btn-text">See how it works</a>
            </div>
            <div className={styles.heroTrust}>
              <div className={styles.trustPill}><span className={styles.dot} />Immediate feedback on Australian leases, HOAs and agreements</div>
              <div className={styles.trustPill}><span className={styles.dot} />Your document stays private</div>
              <div className={styles.trustPill}><span className={styles.dot} />All Australian states covered</div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.hvBar}>
              <span className={styles.hvBarTitle}>Document analysis</span>
              <span className={styles.hvStatus}>Scan complete</span>
            </div>
            <div className={styles.hvBody}>
              <div className={styles.hvDocRow}>
                <div className={styles.hvDocIcon}>
                  <svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 1H2a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V6L8 1z"/>
                    <path d="M8 1v5h5"/>
                  </svg>
                </div>
                <div>
                  <div className={styles.hvDocName}>HOA_Melbourne_CBD_V2.pdf</div>
                  <div className={styles.hvDocMeta}>Uploaded · 847kb · Analysed in 22s</div>
                </div>
              </div>
              <div className={styles.hvScanLabel}>Issues identified, 6 clauses reviewed</div>
              {[
                { risk: 'h', name: 'Ratchet rent review', hint: 'Suggest counter to...' },
                { risk: 'h', name: 'Incentive clawback', hint: 'Request removal of...' },
                { risk: 'm', name: 'Make-good obligations', hint: 'Limit scope to...' },
                { risk: 'm', name: 'Outgoings, new build', hint: 'Consider gross lease...' },
                { risk: 'l', name: 'Personal guarantee', hint: 'Standard, propose...' },
              ].map((c, i) => (
                <div className={styles.hvClauseRow} key={i}>
                  <div className={`${styles.hvRiskBar} ${styles['hvRb' + c.risk.toUpperCase()]}`} />
                  <div className={styles.hvClauseName}>{c.name}</div>
                  <div className={styles.hvBlurred}>{c.hint}</div>
                </div>
              ))}
            </div>
            <div className={styles.hvFooter}>
              <span className={styles.hvFooterText}>2 high · 2 medium · 1 low risk</span>
              <span className={styles.hvFooterBtn} onClick={() => navigate('/analyser')}>Unlock full report →</span>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE STRIP */}
      <div className={styles.valueStrip}>
        <div className={styles.valueInner}>
          {[
            { kicker: 'Identify', title: 'Spot the traps before you sign', body: 'Clauses landlords routinely include, ratchet reviews, clawbacks, demolition rights, identified and explained before they become your problem.' },
            { kicker: 'Protect', title: 'Secure flexibility in your terms', body: 'Know which clauses to push back on and what to ask for, exit rights, permitted use, make-good carve-outs, so you negotiate from a position of knowledge.' },
            { kicker: 'Benchmark', title: 'See how your deal compares', body: 'Your rent, incentives and outgoings benchmarked against market, so you know whether you are being offered a fair deal or an unfair one.' },
            { kicker: 'Grow', title: 'Protect the business you\'re building', body: 'A lease signed on the right terms is a foundation for growth. A lease signed on the wrong terms compounds against you for years.' },
          ].map((v, i) => (
            <div className={styles.vsTile} key={i}>
              <div className={styles.vsKicker}>{v.kicker}</div>
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className={styles.sectionWrap} id="how">
        <div className={styles.section}>
          <div className={styles.sectionKicker}><span className={styles.kickerLine} />How it works</div>
          <h2 className={styles.h2}>Walk into every<br />negotiation prepared.</h2>
          <p className={styles.sectionSub}>LeaseLens reads your HOA or lease the way an experienced professional would, identifying what matters, explaining what it means, and guiding you on how to respond.</p>
          <div className={styles.steps}>
            {[
              { num: '01', title: 'Upload your document', body: 'Drag and drop your HOA or lease. PDF or Word document. Your document is analysed in seconds and results are returned immediately.' },
              { num: '02', title: 'Receive your risk scan', body: 'LeaseLens identifies how many clauses warrant attention and at what level. You see the shape of the issue before you commit to the full report.' },
              { num: '03', title: 'Review the full analysis', body: 'Every relevant clause quoted directly from your document, the risk explained in plain English, and a considered response you can take into the negotiation.' },
            ].map((s, i) => (
              <div className={styles.step} key={i}>
                <div className={styles.stepNum}>{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WHAT YOU GET */}
      <div className={styles.whatSection} id="what">
        <div className={styles.whatInner}>
          <div className={styles.sectionKicker}><span className={styles.kickerLine} />What you get</div>
          <h2 className={styles.h2}>The insight you need at every stage of the process.</h2>
          <p className={styles.sectionSub}>Built from a wide range of retail leasing data across Australian shopping centres, high streets, and mixed-use precincts.</p>
          <div className={styles.whatGrid}>
            {[
              { num: '01', title: 'Clause-by-clause analysis', body: 'Every relevant clause quoted directly from your document with its section reference. The risk explained, the context provided, and a response suggested, in plain English.' },
              { num: '02', title: 'Considered counter positions', body: 'Not warnings, responses. LeaseLens tells you what a reasonable counter looks like for each issue, framed the way an experienced tenant representative would frame it.' },
              { num: '03', title: 'State legislation cross-referenced', body: 'Every analysis is checked against retail tenancy legislation in your state or territory. Where the law supports your position, you will know about it.' },
              { num: '04', title: 'Analysis across every revision', body: 'The full lease negotiation process can be lengthy and run across multiple document versions. Analyse every revision as it arrives and track what has changed.' },
            ].map((c, i) => (
              <div className={styles.whatCard} key={i}>
                <div className={styles.whatCardNum}>{c.num}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className={styles.pricingWrap} id="pricing">
        <div className={styles.pricingSection}>
          <div className={styles.sectionKicker}><span className={styles.kickerLine} />Pricing</div>
          <h2 className={styles.h2}>A fraction of the cost of getting it wrong.</h2>
          <p className={styles.sectionSub}>A single clause missed in a five-year lease can cost tens of thousands. LeaseLens costs less than one hour of specialist advice.</p>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingTier}>One-off report</div>
              <div className={styles.pricingPrice}><sup>$</sup>49</div>
              <p className={styles.pricingDesc}>A single full analysis. No subscription required.</p>
              <div className={styles.pricingRule} />
              <ul className={styles.pricingFeatures}>
                {['Free risk scan included', 'Full clause-by-clause report', 'Counter positions for each issue', 'Downloadable PDF', 'All Australian states'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className={styles.pricingBtn} onClick={() => navigate('/analyser')}>Get one report</button>
            </div>
            <div className={`${styles.pricingCard} ${styles.featured}`}>
              <div className={styles.pricingTier}>Monthly</div>
              <div className={styles.pricingPrice}><sup>$</sup>99<sub>/mo</sub></div>
              <p className={styles.pricingDesc}>Unlimited analyses across the full lease negotiation process.</p>
              <div className={styles.pricingRule} />
              <ul className={styles.pricingFeatures}>
                {['Unlimited HOA and lease analyses', 'Full reports on every revision', 'Document history and version tracking', 'Cancel anytime'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className={`${styles.pricingBtn} ${styles.pricingBtnFeatured}`} onClick={() => navigate('/signup')}>Start monthly plan</button>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingTier}>Professional</div>
              <div className={styles.pricingPrice}><sup>$</sup>299<sub>/mo</sub></div>
              <p className={styles.pricingDesc}>For tenant representatives managing multiple client negotiations.</p>
              <div className={styles.pricingRule} />
              <ul className={styles.pricingFeatures}>
                {['Everything in Monthly', 'Multiple client workspaces', 'Branded PDF reports', 'Priority analysis', 'Early access to new features'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className={styles.pricingBtn}>Contact us</button>
            </div>
          </div>
        </div>
      </div>

      {/* TRUST */}
      <div className={styles.trustSection}>
        <div className={styles.trustInner}>
          <div style={{ marginBottom: 48 }}>
            <div className={styles.sectionKicker}><span className={styles.kickerLine} />Security and confidentiality</div>
            <h2 className={styles.h2} style={{ fontSize: 40, marginBottom: 16 }}>Your document. Handled with care.</h2>
            <p className={styles.sectionSub} style={{ marginBottom: 0 }}>A retail lease or heads of agreement is a confidential commercial document. LeaseLens is built on enterprise-grade security infrastructure.</p>
          </div>
          <div className={styles.trustGrid}>
            {[
              { num: '01', title: 'Encrypted in transit', body: 'All documents are transmitted using TLS encryption, the same standard used by Australian banks and government services.' },
              { num: '02', title: 'Practical intelligence, not legal advice', body: 'LeaseLens provides the practical guidance an experienced tenant representative gives a client. For formal review before execution, engage a qualified solicitor.' },
              { num: '03', title: 'Your confidentiality obligations remain yours', body: 'Most HOAs and leases include a confidentiality clause. Before uploading, check whether your document restricts disclosure to third parties.' },
              { num: '04', title: 'Built for Australia', body: 'Every analysis is cross-referenced against retail tenancy legislation across all eight Australian states and territories.' },
            ].map((t, i) => (
              <div className={styles.trustCard} key={i}>
                <div className={styles.trustNum}>{t.num}</div>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaH2}>Read every word.<br /><em>Miss nothing.</em></h2>
        <div className={styles.ctaRight}>
          <p>Upload your document now. Free scan, results in seconds. Understand exactly where you stand before you respond to the landlord.</p>
          <button className="btn-primary" onClick={() => navigate('/analyser')}>Scan my document free →</button>
        </div>
      </section>

      <Footer />
    </>
  )
}
