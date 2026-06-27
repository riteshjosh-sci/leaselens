import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import styles from './Home.module.css'
import { useSEO } from '../hooks/useSEO'
import leaseroomLogoDark from '../assets/leaseroom-logo-dark.png'
import leaseroomLogoLight from '../assets/leaseroom-logo-light.png'

const STAGES = [
  { n: '01', tab: 'Upload Lease', eyebrow: 'STAGE 01 · UPLOAD LEASE', h: 'Upload Lease',
    p: 'Upload HOA, Lease, Disclosure Statement or supporting documents.' },
  { n: '02', tab: 'Analyse Risks', eyebrow: 'STAGE 02 · ANALYSE RISKS', h: 'Analyse Risks',
    p: 'LeaseRoom extracts clauses, scores risk, identifies obligations and flags issues.' },
  { n: '03', tab: 'Review Recommendations', eyebrow: 'STAGE 03 · REVIEW RECOMMENDATIONS', h: 'Review Recommendations',
    p: 'See counter positions, negotiation opportunities and plain-English explanations.' },
  { n: '04', tab: 'Compare & Customise', eyebrow: 'STAGE 04 · COMPARE & CUSTOMISE', h: 'Compare & Customise',
    p: 'Compare versions, adjust report settings and tailor outputs for your use case.' },
  { n: '05', tab: 'Download & Share', eyebrow: 'STAGE 05 · DOWNLOAD & SHARE REPORT', h: 'Download & Share Report',
    p: 'Generate a professional report with findings, recommendations and executive summary.' },
]

const TRUST_POINTS = [
  { t: 'Statutory grounding', d: 'References the relevant Retail Leases Act for each state & territory.' },
  { t: 'Cost exposure modelling', d: 'Projects outgoings, reviews and make-good over the full term.' },
  { t: 'Counter-position library', d: 'Drafts redlines and fallback positions you can send.' },
]

const COVERAGE_POINTS = [
  { t: 'Rent review mechanics', d: 'Identifies CPI, fixed, market and ratchet review structures, and flags the ones that favour the landlord.' },
  { t: 'Bank guarantee & make-good', d: 'Checks guarantee quantum and the scope of make-good obligations at lease end.' },
  { t: 'Outgoings & audit rights', d: 'Flags uncapped outgoings recovery and the absence of tenant audit rights.' },
  { t: 'Assignment & exclusivity', d: 'Reviews permitted use, exclusivity, and assignment or relocation clauses.' },
]

export default function Home() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const logoSrc = theme === 'dark' ? leaseroomLogoLight : leaseroomLogoDark
  const navigate = useNavigate()
  const observerRef = useRef(null)
  const [activeStage, setActiveStage] = useState(0)
  const [openAcc, setOpenAcc] = useState(0)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')

  useSEO({ title: 'Retail Lease & HOA Analysis for Australian Tenants', path: '/' })

  // Google OAuth round-trips through accounts.google.com and back to whatever
  // URL Supabase's project settings land it on -- if that's "/" instead of
  // "/dashboard", this catches the fresh sign-in and forwards them. Listening
  // for the SIGNED_IN event (not just `user` being set) means an already
  // logged-in visitor who clicks through to the public homepage on purpose
  // isn't bounced back out.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') navigate('/dashboard', { replace: true })
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add(styles.in); observerRef.current.unobserve(e.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    document.querySelectorAll(`.${styles.reveal}`).forEach(el => observerRef.current.observe(el))
    return () => observerRef.current?.disconnect()
  }, [])

  const handleCTA = () => navigate('/analyser')
  const handleSignIn = () => navigate('/login')
  const handleDashboard = () => navigate('/dashboard')

  const handleWaitlistSubmit = async (e) => {
    e.preventDefault()
    setWaitlistError('')
    if (!waitlistEmail.trim() || waitlistEmail.indexOf('@') < 1) {
      setWaitlistError('Enter a valid email address.')
      return
    }
    const { error } = await supabase.from('waitlist').insert({ email: waitlistEmail.trim() })
    if (error && !error.message?.includes('duplicate')) {
      setWaitlistError('Could not join the waitlist — please try again.')
      return
    }
    setWaitlistSubmitted(true)
  }

  const stage = STAGES[activeStage]

  return (
    <div className={styles.page}>

      {/* NAV */}
      <header className={styles.nav}>
        <div className={`${styles.wrap} ${styles.navInner}`}>
          <Link to="/" className={styles.navLogo}>
            <img src={logoSrc} alt="LeaseRoom" className={styles.logoImg} />
          </Link>
          <div className={styles.navCta}>
            <button className={styles.themeToggle} onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {user ? (
              <>
                <button className={styles.signin} onClick={handleDashboard}>Dashboard</button>
                <button className={`${styles.btn} ${styles.btnInk}`} onClick={handleCTA}>Analyse a lease</button>
              </>
            ) : (
              <>
                <button className={styles.signin} onClick={handleSignIn}>Sign in</button>
                <button className={`${styles.btn} ${styles.btnInk}`} onClick={handleCTA}>Analyse a lease</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <span className={styles.eyebrow}>AU · Retail lease &amp; HOA intelligence</span>
          <h1 className={styles.heroH1}>Never sign a retail lease you don't fully understand.</h1>
          <p className={styles.heroSub}>Upload a lease and see every costly clause flagged in plain English — each one traceable to the exact clause and the Retail Leases Act behind it.</p>
          <div className={styles.heroActions}>
            <button className={`${styles.btn} ${styles.btnInk}`} onClick={handleCTA}>Analyse a lease →</button>
          </div>
          <div className={styles.heroTrust}>First lease free · No card required · Data hosted in Australia</div>
        </div>
      </section>

      {/* HOW IT WORKS — tabbed stages */}
      <section id="how" className={styles.section}>
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal} ${styles.sectionHeadCenter}`}>
            <span className={styles.eyebrow}>How it works</span>
            <h2>Your lease, from upload to download.</h2>
            <p className={styles.sectionLead}>Five stages, one continuous flow. Click any stage to see what happens and what you get.</p>
          </div>

          <div className={`${styles.stageTabs} ${styles.reveal}`}>
            {STAGES.map((s, i) => (
              <button
                key={s.n}
                className={`${styles.stageTab} ${activeStage === i ? styles.stageTabActive : ''}`}
                onClick={() => setActiveStage(i)}
              >
                <span className={styles.stageTabNum}>{s.n}</span>
                <span>{s.tab}</span>
              </button>
            ))}
          </div>
          <div className={`${styles.stagePanel} ${styles.reveal}`}>
            <div className={styles.stageShot}>
              <div className={styles.stageShotFrame} />
              <span>{stage.tab} screen</span>
            </div>
            <div className={styles.stageCopy}>
              <span className={styles.stageEyebrow}>{stage.eyebrow}</span>
              <h3>{stage.h}</h3>
              <p>{stage.p}</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST — dark band, accordion */}
      <section id="trust" className={`${styles.section} ${styles.sectionDark}`}>
        <div className={`${styles.wrap} ${styles.trustGrid}`}>
          <div className={`${styles.trustAside} ${styles.reveal}`}>
            <h2 className={styles.bandH2}>From document to defensible position.</h2>
            <p>Two questions, answered. Open each to see exactly how LeaseRoom reads, grounds and reports on your lease.</p>
          </div>
          <div className={`${styles.accList} ${styles.reveal}`}>
            {[
              { q: 'Can I trust the output?', points: TRUST_POINTS },
              { q: 'What will it find in my lease?', points: COVERAGE_POINTS },
            ].map((item, i) => (
              <div key={i} className={styles.accItem}>
                <button className={styles.accQ} onClick={() => setOpenAcc(openAcc === i ? -1 : i)}>
                  <span>{item.q}</span>
                  <span className={styles.accChev}>{openAcc === i ? '–' : '+'}</span>
                </button>
                {openAcc === i && (
                  <div className={styles.accBody}>
                    {item.points.map((p, j) => (
                      <div key={j} className={styles.accPoint}>
                        <span className={styles.accCheck}>✓</span>
                        <div>
                          <div className={styles.accPointT}>{p.t}</div>
                          <div className={styles.accPointD}>{p.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WAITLIST + FINAL CTA */}
      <section id="waitlist" className={`${styles.section} ${styles.final}`}>
        <div className={`${styles.wrap} ${styles.cardStack}`}>
          <div className={`${styles.waitlistCard} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Early access</span>
            <h2>Join the LeaseRoom waitlist.</h2>
            <p>Be first to analyse a lease when we launch. No spam — just your invite and the occasional product update.</p>
            {waitlistSubmitted ? (
              <div className={styles.waitlistDone}>
                <span className={styles.waitlistCheck}>✓</span>
                <span>You're on the list — we'll be in touch at <strong>{waitlistEmail}</strong>.</span>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className={styles.waitlistForm}>
                <input
                  type="email"
                  className="input"
                  placeholder="you@company.com"
                  value={waitlistEmail}
                  onChange={e => setWaitlistEmail(e.target.value)}
                />
                <button type="submit" className={`${styles.btn} ${styles.btnInk}`}>Request Early Access →</button>
              </form>
            )}
            {waitlistError && <p className={styles.waitlistError}>{waitlistError}</p>}
          </div>

          <div className={`${styles.finalCard} ${styles.reveal}`}>
            <h2 className={styles.bandH2}>See every risk before you sign.</h2>
            <p>Upload your first lease or heads of agreement and see every clause flagged in minutes. No card required.</p>
            <div className={styles.finalActions}>
              <button className={`${styles.btn} ${styles.btnFinalPrimary}`} onClick={handleCTA}>Analyse a lease →</button>
              <button className={`${styles.btn} ${styles.btnFinalGhost}`}>Book a demo</button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerTop}`}>
          <div className={styles.footerBrand}>
            <Link to="/" className={styles.footerLogo}>
              <img src={logoSrc} alt="LeaseRoom" className={styles.logoImgSm} />
            </Link>
            <p className={styles.brandBlurb}>Clause-by-clause retail lease &amp; HOA analysis, built for Australian tenants and their advisors.</p>
          </div>
          <div className={styles.footerCol}>
            <h4>Legal</h4>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/terms">Security</Link>
          </div>
        </div>
        <div className={`${styles.wrap} ${styles.footerBottom}`}>
          <span className={styles.legal}>© 2026 LeaseRoom · Made for Australian retail tenants</span>
          <span className={styles.disc}>LeaseRoom provides lease analysis to support your decisions and is not a substitute for legal advice.</span>
        </div>
      </footer>
    </div>
  )
}
