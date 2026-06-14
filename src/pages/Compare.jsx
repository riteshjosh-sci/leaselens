import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './Compare.module.css'

const MenuIcon  = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const SwapIcon  = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 7h12M4 7l3-3M4 7l3 3M16 13H4M16 13l-3-3M16 13l-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ChevIcon  = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ArrowIcon = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const CheckIcon = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>

export default function Compare() {
  const { negotiationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [neg, setNeg]         = useState(null)
  const [docs, setDocs]       = useState([])
  const [v1, setV1]           = useState(null)
  const [v2, setV2]           = useState(null)
  const [report1, setReport1] = useState(null)
  const [report2, setReport2] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { if (!user) { navigate('/login'); return }; fetchAll() }, [negotiationId])

  const fetchAll = async () => {
    const { data: negData } = await supabase
      .from('negotiations')
      .select(`id, property_name, workspace_id,
        documents ( id, filename, version_number, uploaded_at, overall_risk,
          reports ( id, report_json ) )`)
      .eq('id', negotiationId).single()

    if (!negData) { navigate('/dashboard'); return }
    setNeg(negData)
    const sorted = (negData.documents || []).sort((a, b) => a.version_number - b.version_number)
    setDocs(sorted)

    if (sorted.length >= 2) {
      const d1 = sorted[sorted.length - 2]
      const d2 = sorted[sorted.length - 1]
      setV1(d1); setV2(d2)
      setReport1(d1.reports?.[0]?.report_json || null)
      setReport2(d2.reports?.[0]?.report_json || null)
    } else if (sorted.length === 1) {
      setV1(sorted[0])
      setReport1(sorted[0].reports?.[0]?.report_json || null)
    }
    setLoading(false)
  }

  const handleSwap = () => {
    const tmp = v1; setV1(v2); setV2(tmp)
    const tmpR = report1; setReport1(report2); setReport2(tmpR)
  }

  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const clauses1 = report1?.clauses || []
  const clauses2 = report2?.clauses || []

  // Compare clauses
  const allNames = [...new Set([...clauses1.map(c => c.name), ...clauses2.map(c => c.name)])]
  const compared = allNames.map(name => {
    const c1 = clauses1.find(c => c.name === name)
    const c2 = clauses2.find(c => c.name === name)
    let status = 'unchanged'
    if (!c1) status = 'added'
    else if (!c2) status = 'removed'
    else if (c1.danger !== c2.danger || c1.risk !== c2.risk) status = 'modified'
    return { name, c1, c2, status }
  })

  const added    = compared.filter(c => c.status === 'added').length
  const removed  = compared.filter(c => c.status === 'removed').length
  const modified = compared.filter(c => c.status === 'modified').length

  const riskColor = { HIGH: 'var(--risk-h)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }
  const riskBg    = { HIGH: 'var(--risk-h-bg)', MEDIUM: 'var(--risk-m-bg)', LOW: 'var(--risk-l-bg)' }
  const riskBorder= { HIGH: 'var(--risk-h-border)', MEDIUM: 'var(--risk-m-border)', LOW: 'var(--risk-l-border)' }

  const statusColor = { added:'var(--risk-l)', removed:'var(--risk-h)', modified:'var(--risk-m)', unchanged:'var(--navy-muted)' }
  const statusBg    = { added:'var(--risk-l-bg)', removed:'var(--risk-h-bg)', modified:'var(--risk-m-bg)', unchanged:'var(--bg)' }
  const statusLabel = { added:'NEW', removed:'REMOVED', modified:'MODIFIED', unchanged:'' }

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
                <span>›</span>
                {neg?.workspace_id && <button onClick={() => navigate(`/workspace/${neg.workspace_id}`)}>Workspace</button>}
                {neg?.workspace_id && <span>›</span>}
                <button onClick={() => navigate(`/negotiation/${negotiationId}`)}>{neg?.property_name || 'Negotiation'}</button>
                <span>›</span><span>Compare</span>
              </div>
              <h1 className={styles.h1}>Comparison</h1>
              <p className={styles.sub}>Compare two versions and understand the key differences.</p>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <button className="btn-outline btn-sm" onClick={handleSwap}><SwapIcon /> Swap documents</button>
          </div>
        </div>

        {docs.length < 2 ? (
          <div className={styles.content}>
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📄</div>
              <h3>Only one version available</h3>
              <p>Upload a second version to compare changes between documents.</p>
              <button className="btn-gold" onClick={() => navigate(`/negotiation/${negotiationId}`)}>
                Add a version →
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.content}>

            {/* VERSION SELECTORS */}
            <div className={styles.versionRow}>
              <div className={styles.versionCol}>
                <div className={styles.versionLabel}>Original Version</div>
                <div className={styles.versionCard}>
                  <div className={styles.vcIcon}>
                    {v1?.filename?.split('.').pop()?.toUpperCase()}
                  </div>
                  <div className={styles.vcInfo}>
                    <div className={styles.vcName}>{stripTimestamp(v1?.filename)}</div>
                    <div className={styles.vcMeta}>v{v1?.version_number} · {formatDate(v1?.uploaded_at)}</div>
                  </div>
                  {v1?.overall_risk && (
                    <span className={styles.riskPill} style={{background: riskBg[v1.overall_risk], color: riskColor[v1.overall_risk], border: `1px solid ${riskBorder[v1.overall_risk]}`}}>
                      {v1.overall_risk}
                    </span>
                  )}
                  <ChevIcon />
                </div>
              </div>

              <div className={styles.vsLabel}>VS</div>

              <div className={styles.versionCol}>
                <div className={styles.versionLabel}>Revised Version</div>
                <div className={styles.versionCard}>
                  <div className={styles.vcIcon} style={{background:'var(--navy)', color:'#fff'}}>
                    {v2?.filename?.split('.').pop()?.toUpperCase()}
                  </div>
                  <div className={styles.vcInfo}>
                    <div className={styles.vcName}>{stripTimestamp(v2?.filename)}</div>
                    <div className={styles.vcMeta}>v{v2?.version_number} · {formatDate(v2?.uploaded_at)}</div>
                  </div>
                  {v2?.overall_risk && (
                    <span className={styles.riskPill} style={{background: riskBg[v2.overall_risk], color: riskColor[v2.overall_risk], border: `1px solid ${riskBorder[v2.overall_risk]}`}}>
                      {v2.overall_risk}
                    </span>
                  )}
                  <ChevIcon />
                </div>
              </div>
            </div>

            <div className={styles.mainGrid}>
              {/* LEFT — clause comparison */}
              <div className={styles.compareMain}>

                {/* Side by side headers */}
                <div className={styles.sideBySide}>
                  <div className={styles.sidePanel}>
                    <div className={styles.sideHead}>
                      <h3>Original Version</h3>
                      <span className={styles.clauseCount}>{clauses1.length} clauses</span>
                    </div>
                    <div className={styles.clauseRows}>
                      {compared.map((c, i) => (
                        <div key={i} className={`${styles.clauseRow} ${c.status === 'removed' ? styles.removedRow : ''}`}>
                          <div className={styles.crNum}>{i + 1}</div>
                          <div className={styles.crInfo}>
                            <div className={styles.crName}>{c.name}</div>
                            {c.c1 && <div className={styles.crDesc}>{c.c1.risk?.substring(0, 80)}...</div>}
                          </div>
                          {c.c1?.danger && (
                            <div className={styles.crDot} style={{background: riskColor[c.c1.danger]}} />
                          )}
                          {c.status !== 'unchanged' && (
                            <span className={styles.statusDot} style={{background: statusBg[c.status], color: statusColor[c.status]}}>
                              {statusLabel[c.status]}
                            </span>
                          )}
                          <ChevIcon />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.sidePanel}>
                    <div className={styles.sideHead}>
                      <h3>Revised Version</h3>
                      <span className={styles.clauseCount}>{clauses2.length} clauses</span>
                    </div>
                    <div className={styles.clauseRows}>
                      {compared.map((c, i) => (
                        <div key={i} className={`${styles.clauseRow} ${c.status === 'added' ? styles.addedRow : c.status === 'modified' ? styles.modifiedRow : ''}`}>
                          <div className={styles.crNum}>{i + 1}</div>
                          <div className={styles.crInfo}>
                            <div className={styles.crName}>{c.name}</div>
                            {c.c2 && <div className={styles.crDesc}>{c.c2.risk?.substring(0, 80)}...</div>}
                            {!c.c2 && <div className={styles.crDesc} style={{color:'var(--navy-lt)'}}>Clause not present in this version</div>}
                          </div>
                          {c.c2?.danger && (
                            <div className={styles.crDot} style={{background: riskColor[c.c2.danger]}} />
                          )}
                          {c.status === 'added' && (
                            <span className={styles.newBadge}>NEW</span>
                          )}
                          <ChevIcon />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Key differences */}
                {modified > 0 && (
                  <div className={styles.keyDiffs}>
                    <div className={styles.kdHead}>
                      <h3>Key Differences</h3>
                      <button className={styles.viewAllBtn}>View all changes <ArrowIcon /></button>
                    </div>
                    <div className={styles.kdGrid}>
                      {compared.filter(c => c.status === 'modified').slice(0, 3).map((c, i) => (
                        <div key={i} className={styles.kdCard}>
                          <div className={styles.kdIcon} style={{background: c.c2?.danger === 'HIGH' ? 'var(--risk-h-bg)' : c.c2?.danger === 'MEDIUM' ? 'var(--risk-m-bg)' : 'var(--risk-l-bg)'}}>
                            {c.c2?.danger === 'HIGH' ? '🔴' : c.c2?.danger === 'MEDIUM' ? '🟡' : '🟢'}
                          </div>
                          <div className={styles.kdName}>{c.name}</div>
                          <div className={styles.kdDesc}>{c.c2?.risk?.substring(0, 100)}...</div>
                          <div className={styles.kdRisk} style={{color: riskColor[c.c2?.danger || 'LOW']}}>
                            {c.c2?.danger === 'HIGH' ? 'Higher Risk' : c.c2?.danger === 'MEDIUM' ? 'Moderate Impact' : 'Lower Risk'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT — summary sidebar */}
              <div className={styles.compareSide}>

                {/* Comparison summary */}
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>Comparison Summary</h3>
                  <div className={styles.summaryItems}>
                    {[
                      { icon:'🟢', label:'Added Clauses', count: added, color:'var(--risk-l)' },
                      { icon:'🟡', label:'Modified Clauses', count: modified, color:'var(--risk-m)' },
                      { icon:'🔴', label:'Removed Clauses', count: removed, color:'var(--risk-h)' },
                    ].map((s, i) => (
                      <div key={i} className={styles.summaryItem}>
                        <span>{s.icon}</span>
                        <span className={styles.siLabel}>{s.label}</span>
                        <span className={styles.siCount} style={{color: s.color}}>{s.count}</span>
                      </div>
                    ))}
                    <div className={styles.summaryItem}>
                      <span>⬇️</span>
                      <span className={styles.siLabel}>Risk Change</span>
                      <span className={styles.riskChange}>
                        {v2?.overall_risk === 'LOW' ? '↓ Lower Risk' : v2?.overall_risk === 'HIGH' ? '↑ Higher Risk' : '→ Same Risk'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Which version is better */}
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>Which Version is More Favorable?</h3>
                  <div className={styles.favorCard}>
                    <div className={styles.favorIcon}>⚖️</div>
                    <div className={styles.favorTitle}>
                      {v2?.overall_risk <= v1?.overall_risk ? 'Revised Version' : 'Original Version'}
                    </div>
                    <p className={styles.favorDesc}>
                      {v2?.overall_risk === 'LOW' ? 'The revised version reduces overall risk and provides stronger protections.'
                        : 'The original version may have more favorable terms in some areas.'}
                    </p>
                    <div className={styles.favorPoints}>
                      {compared.filter(c => c.status === 'modified' && c.c2?.danger === 'LOW').slice(0, 3).map((c, i) => (
                        <div key={i} className={styles.favorPoint}>
                          <span className={styles.fpCheck}><CheckIcon /></span>
                          <span>{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button className={styles.viewRiskBtn}>View Risk Comparison <ArrowIcon /></button>
                </div>

                {/* Recommendations */}
                <div className={styles.sCard}>
                  <h3 className={styles.sCardTitle}>Recommendations</h3>
                  <div className={styles.recList}>
                    {[
                      { color:'var(--risk-l)', title:'Proceed with Revised Version', sub:'Better protections and lower risk.' },
                      { color:'var(--risk-m)', title:'Review Modified Clauses', sub:'Expanded scope may increase obligations.' },
                      { color:'var(--risk-h)', title:'Verify Data Protection Compliance', sub:'Align with privacy policies.' },
                    ].map((r, i) => (
                      <div key={i} className={styles.recItem}>
                        <div className={styles.recDot} style={{background: r.color}} />
                        <div>
                          <div className={styles.recTitle}>{r.title}</div>
                          <div className={styles.recSub}>{r.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
