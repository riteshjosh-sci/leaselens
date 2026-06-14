import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import ClauseCard from '../components/ClauseCard'
import styles from './ReportView.module.css'

// ── Icons ────────────────────────────────────────────────────────────────────
const MenuIcon    = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const BellIcon    = () => <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6zM8 16a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const DownloadIcon= () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M6 9l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 16h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const ShareIcon   = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="15" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="5" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 9l6-3M7 11l6 3" stroke="currentColor" strokeWidth="1.5"/></svg>
const RefreshIcon = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 4.24 1.76L16 8M16 4v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-4.24-1.76L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const ShieldIcon  = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5l-7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
const CheckIcon   = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ArrowIcon   = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const StarIcon    = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.4 5H18l-4.4 3.2L15.2 16 10 12.8 4.8 16l1.6-5.8L2 7h5.6L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>

const TABS = ['Summary', 'Risk Highlights', 'Clause Analysis', 'Export Report']

export default function ReportView() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [report, setReport]       = useState(null)
  const [document, setDocument]   = useState(null)
  const [negotiation, setNeg]     = useState(null)
  const [ws, setWs]               = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('Summary')
  const [activeClause, setActiveClause] = useState(0)
  const [filter, setFilter]       = useState('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exportDelivery, setExportDelivery] = useState('download')
  const [shareGenerated, setShareGenerated] = useState(null)

  useEffect(() => { fetchReport() }, [id])

  const fetchReport = async () => {
    const { data: rpt, error } = await supabase
      .from('reports')
      .select(`*, documents ( id, filename, version_number, uploaded_at, overall_risk, file_path, negotiation_id,
        negotiations ( id, property_name, workspace_id,
          workspaces ( id, name, client_name, logo_path )
        )
      )`)
      .eq('id', id)
      .single()

    if (error || !rpt) { navigate('/dashboard'); return }

    setReport(rpt.report_json)
    setDocument(rpt.documents)
    const neg = rpt.documents?.negotiations
    const ws  = neg?.workspaces
    setNeg(neg)
    setWs(ws)
    setLoading(false)
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const clauses     = report?.clauses || []
  const highClauses = clauses.filter(c => c.danger === 'HIGH')
  const medClauses  = clauses.filter(c => c.danger === 'MEDIUM')
  const lowClauses  = clauses.filter(c => c.danger === 'LOW')

  const riskScore = highClauses.length > 3 ? 'HIGH' : highClauses.length > 0 ? 'MEDIUM' : 'LOW'
  // Score represents risk level: higher = more risk
  const riskNum   = Math.min(95, Math.max(5, (highClauses.length * 15) + (medClauses.length * 5) + (lowClauses.length * 2)))

  const filteredClauses = filter === 'All' ? clauses
    : filter === 'High' ? highClauses
    : filter === 'Medium' ? medClauses : lowClauses

  const handlePDF = () => { window.open(`/report/${id}/print`, '_blank') }

  const handleShare = async () => {
    try {
      const { data } = await supabase.from('share_tokens').insert({
        report_id: id, user_id: user?.id, expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString()
      }).select().single()
      if (data) {
        await navigator.clipboard.writeText(`${window.location.origin}/shared/${data.token}`)
        alert('Share link copied!')
      }
    } catch(e) { console.error(e) }
  }

  if (loading) return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main"><div className={styles.loading}><div className={styles.ring} /></div></main>
    </div>
  )

  return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main">

        {/* TOP BAR */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}><MenuIcon /></button>
            <div>
              <div className={styles.crumb}>
                <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                {negotiation?.workspace_id && <><span>›</span><button onClick={() => navigate(`/workspace/${negotiation.workspace_id}`)}>{ws?.name || 'Workspace'}</button></>}
                {negotiation && <><span>›</span><button onClick={() => navigate(`/negotiation/${negotiation.id}`)}>{negotiation.property_name || 'Negotiation'}</button></>}
                <span>›</span><span>Report</span>
              </div>
              <h1 className={styles.h1}>{stripTimestamp(document?.filename)}</h1>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.bellBtn}><BellIcon /></button>
            <div className={styles.topbarAvatar}>{user?.email?.[0]?.toUpperCase()}</div>
            <button className="btn-outline btn-sm" onClick={handleShare}><ShareIcon /> Share</button>
            <button className="btn-outline btn-sm" onClick={handlePDF}><DownloadIcon /> Export PDF</button>
            <button className="btn-gold btn-sm" onClick={() => navigate('/analyser')}><RefreshIcon /> Re-run</button>
          </div>
        </div>

        {/* DOCUMENT INFO BAR */}
        <div className={styles.docBar}>
          <div className={styles.docBarInner}>
            <div className={styles.docId}>
              <div className={styles.fileIcon}>{document?.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
              <div>
                <div className={styles.docName}>{stripTimestamp(document?.filename)}</div>
                <div className={styles.docMeta}>
                  <span>Version {document?.version_number}</span>
                  <span className={styles.dot}>·</span>
                  <span>{formatDate(document?.uploaded_at)}</span>
                  <span className={styles.dot}>·</span>
                  <span className={styles[`risk${document?.overall_risk}`]}>● {document?.overall_risk} RISK</span>
                </div>
              </div>
            </div>
            <div className={styles.docStats}>
              <div className={styles.docStat}><span className={styles.dsV}>{clauses.length}</span><span className={styles.dsL}>Clauses</span></div>
              <div className={styles.docStat}><span className={styles.dsV} style={{color:'var(--risk-h)'}}>{highClauses.length}</span><span className={styles.dsL}>High risk</span></div>
              <div className={styles.docStat}><span className={styles.dsV} style={{color:'var(--risk-m)'}}>{medClauses.length}</span><span className={styles.dsL}>Medium</span></div>
              <div className={styles.docStat}><span className={styles.dsV} style={{color:'var(--risk-l)'}}>{lowClauses.length}</span><span className={styles.dsL}>Low</span></div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button key={t} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </div>

        {/* PRINT HEADER — hidden on screen, shows in PDF */}
        <div className={styles.printHeader} style={{display:'none'}}>
          <div className={styles.printHeaderLogo}>Lease<span>Lens</span></div>
          <div className={styles.printHeaderDoc}>
            <div>{stripTimestamp(document?.filename)}</div>
            <div>Generated {new Date().toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
        </div>

        <div className={styles.content}>

          {/* ── TAB: SUMMARY ── */}
          {activeTab === 'Summary' && (
            <div className={styles.summaryLayout}>
              <div className={styles.summaryMain}>
                {/* Summary card */}
                <div className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div className={styles.panelIcon}><StarIcon /></div>
                    <div>
                      <h2 className={styles.panelTitle}>Plain-English Summary</h2>
                      <p className={styles.panelSub}>What this document means for you</p>
                    </div>
                  </div>
                  <p className={styles.summaryText}>{report?.summary}</p>
                </div>

                {/* Next steps */}
                {report?.next_steps?.length > 0 && (
                  <div className={styles.panel}>
                    <div className={styles.panelHead}>
                      <div className={styles.panelIcon} style={{background:'var(--navy)', color:'#fff'}}><ArrowIcon /></div>
                      <div>
                        <h2 className={styles.panelTitle}>Recommended Next Steps</h2>
                        <p className={styles.panelSub}>Actions to take before signing</p>
                      </div>
                    </div>
                    <ol className={styles.nextSteps}>
                      {report.next_steps.map((s, i) => (
                        <li key={i} className={styles.nextStep}>
                          <span className={styles.stepNum}>{i + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Disclaimer */}
                <div className={styles.disclaimerCard}>
                  <ShieldIcon />
                  <p>LeaseLens provides informational analysis to support negotiation and does not constitute legal advice. Always consult a qualified Australian solicitor before signing.</p>
                </div>
              </div>

              {/* Summary sidebar */}
              <div className={styles.summarySide}>
                {/* Risk score */}
                <div className={styles.riskScoreCard}>
                  <h3 className={styles.sCardTitle}>Overall Risk Score</h3>
                  <div className={styles.riskGauge}>
                    <div className={styles.gaugeNum} style={{color: riskScore === 'HIGH' ? 'var(--risk-h)' : riskScore === 'MEDIUM' ? 'var(--risk-m)' : 'var(--risk-l)'}}>
                      {riskNum}
                    </div>
                    <div className={styles.gaugeLabel}>/100</div>
                    <div className={`${styles.riskBadge} ${styles[`badge${riskScore}`]}`}>{riskScore} RISK</div>
                  </div>
                  <div className={styles.riskBreakdown}>
                    {[
                      { label: 'High priority', count: highClauses.length, color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
                      { label: 'Medium', count: medClauses.length, color: 'var(--risk-m)', bg: 'var(--risk-m-bg)' },
                      { label: 'Low / standard', count: lowClauses.length, color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
                    ].map(r => (
                      <div key={r.label} className={styles.rbRow}>
                        <span className={styles.rbDot} style={{background: r.color}} />
                        <span className={styles.rbLabel}>{r.label}</span>
                        <span className={styles.rbCount} style={{color: r.color}}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key takeaways */}
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>Key Takeaways</h3>
                  <div className={styles.takeaways}>
                    {highClauses.slice(0, 5).map((c, i) => (
                      <div key={i} className={styles.takeaway}>
                        <span className={styles.takeawayCheck}><CheckIcon /></span>
                        <span className={styles.takeawayText}>{c.name} — {c.risk?.split('.')[0]}.</span>
                      </div>
                    ))}
                  </div>
                  {highClauses.length > 0 && (
                    <button className={styles.viewAllBtn} onClick={() => setActiveTab('Clause Analysis')}>
                      View all clauses <ArrowIcon />
                    </button>
                  )}
                </div>

                {/* Important tags */}
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>Important Tags</h3>
                  <div className={styles.tags}>
                    {[...new Set(clauses.map(c => c.name.split(/[\s—]/)[0]).filter(Boolean))].slice(0, 8).map((tag, i) => (
                      <span key={i} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: RISK HIGHLIGHTS ── */}
          {activeTab === 'Risk Highlights' && (
            <div className={styles.riskLayout}>
              <div className={styles.riskMain}>
                {/* Risk stat cards */}
                <div className={styles.riskStats}>
                  {[
                    { label: 'High Risk', count: highClauses.length, color: 'var(--risk-h)', bg: 'var(--risk-h-bg)', sub: 'Require immediate attention' },
                    { label: 'Medium Risk', count: medClauses.length, color: 'var(--risk-m)', bg: 'var(--risk-m-bg)', sub: 'Should be reviewed carefully' },
                    { label: 'Low Risk', count: lowClauses.length, color: 'var(--risk-l)', bg: 'var(--risk-l-bg)', sub: 'Generally standard provisions' },
                    { label: 'Total Clauses', count: clauses.length, color: 'var(--navy)', bg: 'var(--navy-ghost)', sub: 'Reviewed in this document' },
                  ].map((s, i) => (
                    <div key={i} className={styles.riskStat} style={{background: s.bg, borderColor: s.color + '30'}}>
                      <div className={styles.rsCount} style={{color: s.color}}>{s.count}</div>
                      <div className={styles.rsLabel}>{s.label}</div>
                      <div className={styles.rsSub}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Top risky clauses */}
                <div className={styles.panel}>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>Top Risky Clauses</h2>
                    <p className={styles.panelSub}>Clauses ranked by risk level</p>
                  </div>
                  <div className={styles.riskClauseList}>
                    {clauses.map((c, i) => (
                      <div key={i} className={`${styles.riskClauseRow} ${activeClause === i ? styles.riskClauseActive : ''}`}
                        onClick={() => setActiveClause(i)}>
                        <span className={styles.rcNum}>{i + 1}</span>
                        <span className={`${styles.rcRisk} ${c.danger === 'HIGH' ? styles.rcHigh : c.danger === 'MEDIUM' ? styles.rcMed : styles.rcLow}`}>
                          {c.danger}
                        </span>
                        <div className={styles.rcInfo}>
                          <div className={styles.rcName}>{c.name}</div>
                          <div className={styles.rcRiskText}>{c.risk?.substring(0, 80)}...</div>
                        </div>
                        <button className={styles.rcBtn}>Review <ArrowIcon /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Professional review banner */}
                {highClauses.length >= 2 && (
                  <div className={styles.reviewBanner}>
                    <div className={styles.reviewBannerIcon}>⚠</div>
                    <div>
                      <div className={styles.reviewBannerTitle}>Professional Legal Review Recommended</div>
                      <div className={styles.reviewBannerSub}>This document contains {highClauses.length} high-risk clauses that may require professional legal review.</div>
                    </div>
                    <button className="btn-outline btn-sm">Request Legal Review</button>
                  </div>
                )}
              </div>

              {/* Risk sidebar — selected clause detail */}
              <div className={styles.riskSide}>
                {clauses[activeClause] && (
                  <div className={styles.clauseExcerpt}>
                    <div className={styles.ceHead}>
                      <span className={styles.ceTitle}>Clause Detail</span>
                      <span className={`${styles.rcRisk} ${clauses[activeClause].danger === 'HIGH' ? styles.rcHigh : clauses[activeClause].danger === 'MEDIUM' ? styles.rcMed : styles.rcLow}`}>
                        {clauses[activeClause].danger} RISK
                      </span>
                    </div>
                    <div className={styles.ceName}>{clauses[activeClause].name}</div>
                    {clauses[activeClause].location && <div className={styles.ceLoc}>{clauses[activeClause].location}</div>}
                    {clauses[activeClause].quote && (
                      <div className={styles.ceQuote}>
                        <div className={styles.ceQuoteLabel}>Clause wording</div>
                        <p>"{clauses[activeClause].quote}"</p>
                      </div>
                    )}
                    {clauses[activeClause].risk && (
                      <div className={styles.ceBlock}>
                        <div className={styles.ceBlockLabel}>What this means</div>
                        <p>{clauses[activeClause].risk}</p>
                      </div>
                    )}
                    {clauses[activeClause].counter && (
                      <div className={`${styles.ceBlock} ${styles.ceCounter}`}>
                        <div className={styles.ceBlockLabel}>Suggested counter</div>
                        <p>{clauses[activeClause].counter}</p>
                      </div>
                    )}
                    {clauses[activeClause].legislation && (
                      <div className={`${styles.ceBlock} ${styles.ceLeg}`}>
                        <div className={styles.ceBlockLabel}>Relevant legislation</div>
                        <p>{clauses[activeClause].legislation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* What to do next */}
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>What to Do Next</h3>
                  <div className={styles.todoList}>
                    {[
                      { icon: '🔴', title: 'Review high-risk clauses', sub: `Focus on the ${highClauses.length} high-risk clauses first` },
                      { icon: '🔵', title: 'Negotiate better terms', sub: 'Request changes to limit liability and add protections' },
                      { icon: '🟡', title: 'Consult legal counsel', sub: 'Have a lawyer review critical clauses before signing' },
                    ].map((t, i) => (
                      <div key={i} className={styles.todoItem}>
                        <span>{t.icon}</span>
                        <div>
                          <div className={styles.todoTitle}>{t.title}</div>
                          <div className={styles.todoSub}>{t.sub}</div>
                        </div>
                        <ArrowIcon />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: CLAUSE ANALYSIS ── */}
          {activeTab === 'Clause Analysis' && (
            <div className={styles.clauseLayout}>
              {/* Left — clause list */}
              <div className={styles.clauseList}>
                <div className={styles.clauseListHead}>
                  <h3>{clauses.length} clauses found</h3>
                  <div className={styles.filterTabs}>
                    {['All', 'High', 'Medium', 'Low'].map(f => (
                      <button key={f} className={`${styles.filterTab} ${filter === f ? styles.filterActive : ''}`}
                        onClick={() => setFilter(f)}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.clauseItems}>
                  {filteredClauses.map((c, i) => {
                    const idx = clauses.indexOf(c)
                    return (
                      <div key={i} className={`${styles.clauseItem} ${activeClause === idx ? styles.clauseItemActive : ''}`}
                        onClick={() => setActiveClause(idx)}>
                        <div className={`${styles.ciIcon} ${c.danger === 'HIGH' ? styles.ciHigh : c.danger === 'MEDIUM' ? styles.ciMed : styles.ciLow}`}>
                          {c.danger === 'HIGH' ? '⚠' : c.danger === 'MEDIUM' ? '⚡' : '✓'}
                        </div>
                        <div className={styles.ciInfo}>
                          <div className={styles.ciName}>{c.name}</div>
                          <div className={styles.ciLoc}>{c.location}</div>
                          <div className={`${styles.ciRisk} ${c.danger === 'HIGH' ? styles.ciRiskHigh : c.danger === 'MEDIUM' ? styles.ciRiskMed : styles.ciRiskLow}`}>
                            {c.danger} Impact
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button className={styles.viewAllClauses}>View all clauses ({clauses.length})</button>
              </div>

              {/* Centre — clause detail */}
              <div className={styles.clauseDetail}>
                {clauses[activeClause] ? (
                  <>
                    <div className={styles.cdHead}>
                      <div>
                        <h2 className={styles.cdName}>{clauses[activeClause].name}</h2>
                        <div className={styles.cdLoc}>{clauses[activeClause].location}</div>
                      </div>
                      <div className={styles.cdBadges}>
                        <span className={`${styles.rcRisk} ${clauses[activeClause].danger === 'HIGH' ? styles.rcHigh : clauses[activeClause].danger === 'MEDIUM' ? styles.rcMed : styles.rcLow}`}>
                          {clauses[activeClause].danger} IMPACT
                        </span>
                        <span className={styles.obligationBadge}>Obligation</span>
                      </div>
                    </div>

                    {clauses[activeClause].quote && (
                      <div className={styles.cdQuote}>
                        <div className={styles.cdQuoteLabel}>Original clause (excerpt)</div>
                        <p>"{clauses[activeClause].quote}"</p>
                      </div>
                    )}

                    {clauses[activeClause].risk && (
                      <div className={styles.cdSection}>
                        <div className={styles.cdSectionHead}>
                          <span className={styles.cdSectionIcon}>📋</span>
                          <h4>Plain-English Explanation</h4>
                        </div>
                        <p>{clauses[activeClause].risk}</p>
                      </div>
                    )}

                    {clauses[activeClause].counter && (
                      <div className={`${styles.cdSection} ${styles.cdSectionCounter}`}>
                        <div className={styles.cdSectionHead}>
                          <span className={styles.cdSectionIcon}>💬</span>
                          <h4>Suggested Counter</h4>
                        </div>
                        <p>{clauses[activeClause].counter}</p>
                      </div>
                    )}

                    {clauses[activeClause].legislation && (
                      <div className={`${styles.cdSection} ${styles.cdSectionLeg}`}>
                        <div className={styles.cdSectionHead}>
                          <span className={styles.cdSectionIcon}>⚖️</span>
                          <h4>Relevant Legislation</h4>
                        </div>
                        <p>{clauses[activeClause].legislation}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.cdEmpty}>Select a clause to view details</div>
                )}
              </div>

              {/* Right — tips sidebar */}
              <div className={styles.clauseSide}>
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>💡 Negotiation tips</h3>
                  <div className={styles.tipList}>
                    {[
                      'Counter positions should be anchored to market standard, not the document position.',
                      'Always get material representations confirmed in writing before signing.',
                      'Board approval deadlines protect you if terms change after you\'ve committed.',
                      'Request 3 months bank guarantee — 6+ months is above market standard.',
                    ].map((tip, i) => (
                      <div key={i} className={styles.tipItem}>
                        <span className={styles.tipCheck}><CheckIcon /></span>
                        <span>{tip}</span>
                      </div>
                    ))}
                    <button className={styles.viewAllBtn}>See more tips <ArrowIcon /></button>
                  </div>
                </div>

                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>🔗 Related clauses</h3>
                  <div className={styles.relatedList}>
                    {clauses.filter((_, i) => i !== activeClause).slice(0, 3).map((c, i) => (
                      <div key={i} className={styles.relatedItem} onClick={() => setActiveClause(clauses.indexOf(c))}>
                        <div className={styles.relatedName}>{c.name}</div>
                        <div className={styles.relatedLoc}>{c.location}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: EXPORT REPORT ── */}
          {activeTab === 'Export Report' && (
            <div className={styles.exportLayout}>
              <div className={styles.exportMain}>
                {/* Step 1 */}
                <div className={styles.exportStep}>
                  <div className={styles.stepNum2}>1</div>
                  <div className={styles.stepBody}>
                    <h3 className={styles.stepTitle}>Choose export format</h3>
                    <p className={styles.stepSub}>Select the format that best suits your needs.</p>
                    <div className={styles.formatGrid}>
                      {[
                        { id: 'pdf', icon: '📄', label: 'PDF', desc: 'Best for printing and sharing.' },
                        { id: 'share', icon: '🔗', label: 'Shareable Link', desc: 'Secure link with access control.' },
                      ].map(f => (
                        <div key={f.id}
                          className={`${styles.formatCard} ${exportFormat === f.id ? styles.formatActive : ''}`}
                          onClick={() => setExportFormat(f.id)}>
                          <span className={styles.formatIcon}>{f.icon}</span>
                          <div className={styles.formatLabel}>{f.label}</div>
                          <div className={styles.formatDesc}>{f.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 2 — Delivery */}
                <div className={styles.exportStep}>
                  <div className={styles.stepNum2}>2</div>
                  <div className={styles.stepBody}>
                    <h3 className={styles.stepTitle}>Delivery options</h3>
                    <p className={styles.stepSub}>Choose how you would like to receive your report.</p>
                    <div className={styles.deliveryList}>
                      {[
                        { id:'download', icon: '⬇️', label: 'Download Now', sub: 'Download the report to your device.' },
                        { id:'link', icon: '🔗', label: 'Secure Share Link', sub: 'Generate a secure link with access controls.' },
                      ].map((d) => (
                        <div key={d.id}
                          className={`${styles.deliveryItem} ${exportDelivery === d.id ? styles.deliveryActive : ''}`}
                          onClick={() => setExportDelivery(d.id)}>
                          <span className={styles.dIcon}>{d.icon}</span>
                          <div>
                            <div className={styles.dLabel}>{d.label}</div>
                            <div className={styles.dSub}>{d.sub}</div>
                          </div>
                          <div className={`${styles.dRadio} ${exportDelivery === d.id ? styles.dRadioActive : ''}`} />
                        </div>
                      ))}
                    </div>
                    {shareGenerated && (
                      <div className={styles.shareResult}>
                        <input className={styles.shareInput} value={shareGenerated} readOnly />
                        <button className="btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(shareGenerated); }}>Copy</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generate button */}
                <button className={styles.generateBtn} onClick={async () => {
                  if (exportFormat === 'pdf') {
                    handlePDF()
                  } else {
                    try {
                      const { data, error } = await supabase.from('share_tokens').insert({
                        user_id: user?.id,
                        report_id: id,
                        workspace_id: negotiation?.workspace_id || null,
                        label: `Report share — ${new Date().toLocaleDateString('en-AU')}`,
                        expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString()
                      }).select().single()
                      if (error) { console.error('Share error:', error); alert('Failed to generate share link: ' + error.message); return }
                      if (data?.token) {
                        const url = `${window.location.origin}/shared/${data.token}`
                        setShareGenerated(url)
                        await navigator.clipboard.writeText(url)
                      }
                    } catch(e) { console.error(e); alert('Failed to generate share link.') }
                  }
                }}>
                  <DownloadIcon /> {exportFormat === 'pdf' ? 'Generate & Download PDF' : 'Generate Share Link'}
                </button>
                <div className={styles.exportMeta}>🔒 Encrypted export · Access controlled · Audit logged</div>
              </div>

              {/* Preview */}
              <div className={styles.exportSide}>
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>Report preview</h3>
                  <p className={styles.panelSub}>This is how your report cover will look.</p>
                  <div className={styles.previewCard}>
                    <div className={styles.previewLogo}>⚖️</div>
                    <div className={styles.previewWs}>{ws?.client_name || ws?.name || 'LeaseLens'}</div>
                    <div className={styles.previewTitle}>{negotiation?.property_name || 'Lease Analysis Report'}</div>
                    <div className={styles.previewSub}>Prepared by LeaseLens</div>
                    <div className={styles.previewDate}>Generated on {new Date().toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' })}</div>
                    <div className={styles.previewConfidential}>This report is confidential and intended solely for the use of the tenant.</div>
                  </div>
                </div>

                <div className={styles.securityCard2}>
                  <ShieldIcon />
                  <div className={styles.sc2Title}>Your data is protected</div>
                  <p>All reports are encrypted in transit and at rest. Access is controlled and fully auditable.</p>
                </div>
              </div>
            </div>
          )}

        </div>
        </div>
        </div>
        {/* PRINT FOOTER — hidden on screen */}
        <div className={styles.printFooter} style={{display:'none'}}>
          <span>LeaseLens — Retail Lease Intelligence</span>
          <span>This report is confidential and does not constitute legal advice.</span>
          <span>{negotiation?.property_name || ''}</span>
        </div>

      </main>
    </div>
  )
}
