import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import Footer from '../components/Footer'
import styles from './Home.module.css'
import { useSEO } from '../hooks/useSEO'

const ViewfinderMark = ({ size = 30, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ color }}>
    <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8.5l3 3 7-7.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const STAGES = [
  { n: '01', tab: 'Upload', eyebrow: 'STAGE 01 · UPLOAD', h: 'Upload your document',
    p: 'Drop in a retail lease, heads of agreement, or renewal offer — PDF or Word, from any Australian state. Nothing to install, no account required to start.' },
  { n: '02', tab: 'Analyse', eyebrow: 'STAGE 02 · ANALYSE', h: 'We read it like a negotiator',
    p: 'LeaseRoom reviews every clause against retail tenancy legislation and the outcomes of thousands of real leases — separating what\'s standard from what\'s aggressive, and what\'s quietly negotiable.' },
  { n: '03', tab: 'Review', eyebrow: 'STAGE 03 · REVIEW', h: 'Review the recommendations',
    p: 'Each flagged clause comes with a plain-English explanation and a considered counter-position, ready to take straight into the conversation.' },
  { n: '04', tab: 'Compare', eyebrow: 'STAGE 04 · COMPARE', h: 'Compare versions as they land',
    p: 'Upload the landlord\'s revised draft and see exactly what was resolved, what\'s unchanged, and what\'s new — side by side with the original.' },
  { n: '05', tab: 'Share', eyebrow: 'STAGE 05 · DOWNLOAD & SHARE', h: 'Download & share the report',
    p: 'Export a client-ready PDF, or share a live link — built for sending straight to a client, a colleague, or the agent on the other side of the table.' },
]

export default function Home() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const observerRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeStage, setActiveStage] = useState(0)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')

  useSEO({ title: 'Retail Lease & HOA Analysis for Australian Tenants', path: '/' })

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    // Reveal on scroll
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add(styles.in); observerRef.current.unobserve(e.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    document.querySelectorAll(`.${styles.reveal}`).forEach(el => observerRef.current.observe(el))

    // Sticky nav border
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); observerRef.current?.disconnect() }
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
      <header className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
        <div className={`${styles.wrap} ${styles.navInner}`}>
          <Link to="/" className={styles.navLogo}>
            <ViewfinderMark size={30} />
            <span className={styles.wordmark}>Lease<span className={styles.lens}>Room</span></span>
          </Link>
          <nav className={styles.navLinks}>
            <a href="#how">How it works</a>
            <a href="#report">What you get</a>
            <a href="#who">Who it's for</a>
            <a href="#pricing">Pricing</a>
            <a href="#trust">Privacy</a>
          </nav>
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
          <button className={styles.navBurger}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}>
            <span style={menuOpen ? {transform:'translateY(7px) rotate(45deg)'} : {}} />
            <span style={menuOpen ? {opacity:0} : {}} />
            <span style={menuOpen ? {transform:'translateY(-7px) rotate(-45deg)'} : {}} />
          </button>
        </div>
        {menuOpen && <div className={styles.mobileMenu}>
          <button className={styles.themeToggleMobile} onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
          </button>
          <a href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#report" onClick={() => setMenuOpen(false)}>What you get</a>
          <a href="#who" onClick={() => setMenuOpen(false)}>Who it's for</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#trust" onClick={() => setMenuOpen(false)}>Privacy</a>
          {user
            ? <button className={`${styles.btn} ${styles.btnInk}`} onClick={() => { handleDashboard(); setMenuOpen(false) }}>Dashboard</button>
            : <><button className={styles.signinMobile} onClick={() => { handleSignIn(); setMenuOpen(false) }}>Sign in</button>
               <button className={`${styles.btn} ${styles.btnInk}`} onClick={() => { handleCTA(); setMenuOpen(false) }}>Analyse a lease</button></>
          }
        </div>}
      </header>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>AU · Retail lease &amp; HOA intelligence</span>
            <h1 className={styles.heroH1}>Never sign a retail lease you don't fully understand.</h1>
            <p className={styles.heroSub}>LeaseRoom reads your retail lease or heads of agreement like an experienced negotiator — flagging what matters, explaining what it means, and showing you exactly how to respond.</p>
            <div className={styles.heroActions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCTA}>Analyse a lease →</button>
              <a className={`${styles.btn} ${styles.btnGhost}`} href="#how"><span className={styles.ul}>See how it works</span></a>
            </div>
            <div className={styles.heroTrust}>
              <div className={styles.trustDot}>Considered analysis of Australian leases, HOAs &amp; renewal offers</div>
              <div className={styles.trustRow}>
                <div className={styles.trustDot}>Your document stays private</div>
                <div className={styles.trustDot}>Every state &amp; territory covered</div>
              </div>
            </div>
          </div>

          {/* Analysis card */}
          <div className={`${styles.card} ${styles.analysis}`}>
            <div className={styles.analysisHead}>
              <span className={styles.analysisT}>DOCUMENT ANALYSIS</span>
              <span className={styles.analysisS}>Scan complete</span>
            </div>
            <div className={styles.analysisBody}>
              <div className={styles.fileRow}>
                <div className={styles.fileIco}>PDF</div>
                <div className={styles.fileMeta}>
                  <span className={styles.fileN}>HOA_Melbourne_CBD_v2.pdf</span>
                  <span className={styles.fileD}>Uploaded · 847 kb · Analysed in 22s</span>
                </div>
              </div>
              <div className={styles.issuesLabel}>6 CLAUSES REVIEWED · 5 FLAGGED FOR ATTENTION</div>
              <div className={styles.risks}>
                {[
                  { label: 'Ratchet rent review', tag: 'Counter to CPI or market', level: 'high' },
                  { label: 'Incentive clawback', tag: 'Request removal', level: 'high' },
                  { label: 'Make-good obligations', tag: 'Limit scope & condition', level: 'med' },
                  { label: 'Outgoings — new build', tag: 'Negotiate a cap', level: 'med' },
                  { label: 'Permitted use', tag: 'Standard — proceed', level: 'low' },
                ].map((r, i) => (
                  <div key={i} className={styles.risk}>
                    <span className={styles.riskBar} style={{ background: r.level === 'high' ? 'var(--risk-h)' : r.level === 'med' ? 'var(--risk-m)' : 'var(--risk-l)' }} />
                    <span className={styles.riskLbl}>{r.label}</span>
                    <span className={styles.riskTag}>{r.tag}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.analysisFoot}>
              <span className={styles.analysisSum}><b className={styles.accent}>2 high</b> · 2 medium · 1 low priority</span>
              <button className={`${styles.accent} ${styles.analysisCta}`} onClick={handleCTA}>UNLOCK FULL REPORT →</button>
            </div>
          </div>
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

      {/* WHAT YOU GET */}
      <section id="report" className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.wrap}>
          <div className={styles.report}>
            <div className={`${styles.reportAside} ${styles.reveal}`}>
              <span className={styles.eyebrow}>What you get</span>
              <h2>Not a risk score. A briefing.</h2>
              <p>Every flag is a complete picture: the clause quoted from your document, what it actually means, why it matters to you, and a specific response you can put on the table.</p>
              <div className={styles.reportList}>
                {[
                  ['The clause, verbatim', '— quoted with its section reference, never paraphrased.'],
                  ['Plain-English meaning', '— what it commits you to, without the legalese.'],
                  ['Why it matters', '— the real-world cost or exposure, in context.'],
                  ['A suggested counter', '— a concrete position, grounded in legislation.'],
                ].map(([b, t], i) => (
                  <div key={i} className={styles.reportItem}>
                    <span className={styles.reportK}>✓</span>
                    <span className={styles.reportTx}><b>{b}</b>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${styles.clauseCard} ${styles.reveal}`}>
              <div className={styles.clauseTop}>
                <span className={styles.clauseRef}>CLAUSE 4.2 — RENT REVIEW</span>
                <span className={`${styles.pill} ${styles.pillHigh}`}>High priority</span>
              </div>
              <div className={styles.quote}>
                "On each review date the annual rent shall be the greater of the rent payable in the preceding year increased by CPI, or the current market rent as determined by the Lessor's valuer."
              </div>
              {[
                { h: 'What this means', act: false, p: 'This is a "ratchet" clause. Rent can rise to market or CPI — whichever is higher — but the wording prevents it from ever falling, even if the market softens. The Lessor also nominates the valuer.' },
                { h: 'Why it matters', act: false, p: 'Over a 5-year term in a declining market you could pay well above market rent with no mechanism to correct it. Ratchet clauses are prohibited in several states\' retail leasing legislation.' },
                { h: 'Suggested counter', act: true, p: 'Request the "greater of" be struck so reviews track CPI or market alone, and that any market valuation use an independent valuer agreed by both parties. Cite the prohibition on ratchet provisions in your state\'s Retail Leases Act.' },
              ].map((s, i) => (
                <div key={i} className={styles.clauseSection}>
                  <span className={`${styles.clauseH} ${s.act ? styles.clauseHAct : ''}`}>{s.h}</span>
                  <p>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" className={styles.section}>
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Who it's for</span>
            <h2>Whether it's your first lease or your fortieth this year.</h2>
          </div>
          <div className={styles.audience}>
            {[
              {
                role: 'Retailers & business owners',
                h: 'Sign the biggest contract your business holds — with your eyes open.',
                lead: 'You don\'t need a legal background. LeaseRoom translates the lease into plain language and tells you what to push back on, so you walk in informed instead of hopeful.',
                items: ['Understand exactly what you\'re agreeing to before you sign', 'Know which terms are standard and which are worth a fight', 'Spend your solicitor\'s time on the issues that actually matter'],
              },
              {
                role: 'Tenant reps & negotiators',
                h: 'Triage a lease in minutes, and back every position with evidence.',
                lead: 'Built for the professionals who do this all day. Cut review time without cutting corners, and show clients precisely where you added value.',
                items: ['First-pass review of a full lease in minutes, not hours', 'Legislation-referenced counters for every flagged clause', 'A clear, client-ready summary you can send as-is'],
              },
            ].map((a, i) => (
              <div key={i} className={`${styles.audCard} ${styles.reveal}`}>
                <span className={styles.audRole}>{a.role}</span>
                <h3>{a.h}</h3>
                <p className={styles.audLead}>{a.lead}</p>
                <ul>
                  {a.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST — dark band */}
      <section id="trust" className={`${styles.section} ${styles.sectionDark}`}>
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={`${styles.eyebrow} ${styles.eyebrowLt}`}>Why you can trust it</span>
            <h2 className={styles.bandH2}>Confidential by default. Grounded in law.</h2>
          </div>
          <div className={styles.trustGrid}>
            {[
              { h: 'Your document stays yours', p: 'Encrypted in transit and at rest. We never sell your documents and never use them to train models. Delete any file permanently, any time, with one click.' },
              { h: 'Anchored in legislation', p: 'Every flag is cross-referenced to the Retail Leases Act that governs your state or territory — so each suggested position rests on the law, not opinion.' },
              { h: 'Clear about its limits', p: 'LeaseRoom makes you a sharper, better-prepared client. It doesn\'t pretend to be your solicitor — and it tells you plainly when an issue warrants formal legal advice.' },
            ].map((t, i) => (
              <div key={i} className={`${styles.trustItem} ${styles.reveal}`}>
                <h3>{t.h}</h3>
                <div className={styles.trustRule} />
                <p>{t.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className={styles.section}>
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Pricing</span>
            <h2>Pay for a scan. Or negotiate all year.</h2>
          </div>
          <div className={styles.pricing}>
            {[
              {
                tier: 'Single scan', amt: '$49', per: '/ document',
                blurb: 'For the one lease in front of you, right now.',
                items: ['Full clause-by-clause report', 'Suggested counters for every flag', 'Exportable PDF summary'],
                cta: 'Analyse a lease', featured: false,
              },
              {
                tier: 'Professional', amt: '$99', per: '/ month',
                blurb: 'For reps and advisors reviewing leases regularly.',
                items: ['Unlimited document scans', 'Client-ready branded summaries', 'Clause comparison across versions', 'Priority analysis & support'],
                cta: 'See full pricing', featured: true, badge: 'Most popular',
              },
              {
                tier: 'Adviser', amt: '$299', per: '/ month',
                blurb: 'For brokerages and advisory teams.',
                items: ['Everything in Professional', 'Multiple client workspaces', 'Branded PDF reports'],
                cta: 'See full pricing', featured: false,
              },
            ].map((p, i) => (
              <div key={i} className={`${styles.priceCard} ${p.featured ? styles.priceCardFeatured : ''} ${styles.reveal}`}>
                {p.badge && <span className={styles.priceBadge}>{p.badge}</span>}
                <span className={styles.priceTier}>{p.tier}</span>
                <div className={styles.priceAmt}>{p.amt}{p.per && <span className={styles.pricePer}> {p.per}</span>}</div>
                <p className={styles.priceBlurb}>{p.blurb}</p>
                <ul>
                  {p.items.map((item, j) => (
                    <li key={j}><CheckIcon />{item}</li>
                  ))}
                </ul>
                <button
                  className={`${styles.btn} ${p.featured ? styles.btnPrimary : styles.btnInk}`}
                  onClick={() => navigate('/pricing')}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Questions</span>
            <h2>The honest answers.</h2>
          </div>
          <div className={styles.faq}>
            {[
              { q: 'Does this replace a lawyer?', a: 'No — and it won\'t pretend to. LeaseRoom makes you a sharper, better-prepared client: you\'ll know exactly what to ask and what to push on. For binding legal advice, see a solicitor. For knowing where to spend their time, start here.' },
              { q: 'What documents can I upload?', a: 'Retail and commercial leases, heads of agreement, renewal and variation offers, and disclosure statements — as PDF or Word. If it governs your tenancy, LeaseRoom can read it.' },
              { q: 'Which states does it cover?', a: 'Every Australian state and territory. Each analysis is matched to the retail tenancy legislation that governs the premises in your document.' },
              { q: 'Is my document kept private?', a: 'Yes. Files are encrypted in transit and at rest, never sold, and never used to train models. You can permanently delete any document at any time.' },
            ].map((qa, i) => (
              <div key={i} className={`${styles.qa} ${styles.reveal}`}>
                <button className={styles.qaQ} aria-expanded="false" onClick={e => {
                  const btn = e.currentTarget
                  const open = btn.getAttribute('aria-expanded') === 'true'
                  const answer = btn.nextElementSibling
                  btn.setAttribute('aria-expanded', String(!open))
                  answer.style.maxHeight = open ? null : answer.scrollHeight + 'px'
                }}>
                  <h3>{qa.q}</h3>
                  <span className={styles.qaIcon} aria-hidden="true" />
                </button>
                <div className={styles.qaA}><p>{qa.a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" className={styles.section}>
        <div className={styles.wrap}>
          <div className={`${styles.waitlistCard} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Early access</span>
            <h2>Join the LeaseRoom waitlist.</h2>
            <p>Be first to know about new features and state coverage as they ship. No spam — just your invite and the occasional product update.</p>
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
                <button type="submit" className={`${styles.btn} ${styles.btnInk}`}>Join waitlist →</button>
              </form>
            )}
            {waitlistError && <p className={styles.waitlistError}>{waitlistError}</p>}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className={`${styles.section} ${styles.sectionDark} ${styles.final}`}>
        <div className={styles.wrap}>
          <span className={`${styles.eyebrow} ${styles.eyebrowLt} ${styles.eyebrowCenter}`}>Lease intelligence</span>
          <h2 className={styles.bandH2} style={{ marginTop: 20 }}>Know what you're signing<br />before you sign.</h2>
          <p>Upload your lease and see the first flags in under a minute. No account needed to start.</p>
          <div className={styles.finalActions}>
            <button className={`${styles.btn} ${styles.btnFinalPrimary}`} onClick={handleCTA}>Analyse a lease →</button>
            <button className={`${styles.btn} ${styles.btnFinalGhost}`}>Book a walkthrough</button>
          </div>
          <p className={styles.reassure}>Trusted by retailers and tenant representatives across Australia.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link to="/" className={styles.footerLogo}>
                <ViewfinderMark size={28} />
                <span className={styles.wordmark} style={{ fontSize: 21 }}>Lease<span className={styles.lens}>Room</span></span>
              </Link>
              <p className={styles.brandBlurb}>Lease intelligence for retailers and the professionals who negotiate on their behalf.</p>
            </div>
            <div className={styles.footerCol}>
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#report">What you get</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className={styles.footerCol}>
              <h4>Company</h4>
              <Link to="/privacy">Privacy &amp; security</Link>
              <Link to="/terms">Terms</Link>
            </div>
            <div className={styles.footerCol}>
              <h4>Get started</h4>
              <button onClick={handleCTA}>Analyse a lease</button>
              <button onClick={handleSignIn}>Sign in</button>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span className={styles.legal}>© 2026 LeaseRoom. All rights reserved.</span>
            <span className={styles.disc}>LeaseRoom provides informational analysis to support negotiation and does not constitute legal advice.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
