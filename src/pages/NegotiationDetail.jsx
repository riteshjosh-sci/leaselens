import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './NegotiationDetail.module.css'

const LIFECYCLE = ['Reviewing', 'Counter prepared', 'Sent to agent', 'Awaiting response', 'Agreed']
const LC_KEYS   = ['reviewing', 'counter_prepared', 'sent', 'awaiting', 'agreed']

const MenuIcon   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const PlusIcon   = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const DocIcon    = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const ChevIcon   = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const CheckIcon  = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ArrowIcon  = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ShieldIcon = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5l-7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>

export default function NegotiationDetail() {
  const { id: negId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [neg, setNeg]             = useState(null)
  const [ws, setWs]               = useState(null)
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [decisions, setDecisions] = useState({})
  const [lifecycle, setLifecycle] = useState('reviewing')
  const [savingDecision, setSavingDecision] = useState(false)
  const [activeClause, setActiveClause] = useState(0)
  const [filter, setFilter]       = useState('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openClauseKey, setOpenClauseKey] = useState(null)

  useEffect(() => { if (!user) { navigate('/login'); return }; fetchAll() }, [negId, user])

  const fetchAll = async () => {
    const { data: negData, error } = await supabase
      .from('negotiations')
      .select(`id, property_name, created_at, status, workspace_id, lifecycle,
        documents ( id, filename, version_number, uploaded_at, overall_risk, file_path,
          reports ( id, report_json ) )`)
      .eq('id', negId).single()

    if (error || !negData) { navigate('/dashboard'); return }
    setNeg(negData)
    setLifecycle(negData.lifecycle || 'reviewing')

    const sortedDocs = (negData.documents || []).sort((a, b) => b.version_number - a.version_number)
    setDocs(sortedDocs)

    if (negData.workspace_id) {
      const { data: wsData } = await supabase.from('workspaces')
        .select('id, name, client_name, logo_path').eq('id', negData.workspace_id).single()
      setWs(wsData)
    }

    const { data: savedDecisions } = await supabase.from('clause_decisions')
      .select('clause_key, decision').eq('negotiation_id', negId)
    if (savedDecisions?.length) {
      const decMap = {}
      savedDecisions.forEach(d => { decMap[d.clause_key] = d.decision })
      setDecisions(decMap)
    }
    setLoading(false)
  }

  const toggleDecision = async (clauseKey, action, clauseName) => {
    const newDecision = decisions[clauseKey] === action ? 'open' : action
    const newDecisions = { ...decisions, [clauseKey]: newDecision }
    setDecisions(newDecisions)
    setSavingDecision(true)
    try {
      if (newDecision === 'open') {
        await supabase.from('clause_decisions').delete().eq('negotiation_id', negId).eq('clause_key', clauseKey)
      } else {
        await supabase.from('clause_decisions').upsert({
          negotiation_id: negId, clause_key: clauseKey, clause_name: clauseName, decision: newDecision,
        }, { onConflict: 'negotiation_id,clause_key' })
      }
      const hasCountering = Object.values(newDecisions).some(d => d === 'countering')
      const autoLifecycle = hasCountering ? 'counter_prepared' : 'reviewing'
      if (['reviewing', 'counter_prepared'].includes(lifecycle)) await updateLifecycle(autoLifecycle)
    } catch(e) { console.error(e) }
    setSavingDecision(false)
  }

  const updateLifecycle = async (newStage) => {
    setLifecycle(newStage)
    await supabase.from('negotiations').update({ lifecycle: newStage }).eq('id', negId)
  }

  const handleAnalyseVersion = async () => {
    navigate('/analyser', { state: { negotiationId: negId, workspaceId: neg?.workspace_id } })
  }

  const handleDeleteVersion = async (docId) => {
    if (!confirm('Delete this document version?')) return
    const doc = docs.find(d => d.id === docId)
    if (doc?.file_path) await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', docId)
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  const stripTimestamp = f => f?.replace(/^\d+_/, '').replace(/\.[^.]+$/, '') || ''
  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const latestReport = docs.find(d => d.reports?.[0]?.report_json)
  const allClauses = latestReport
    ? (latestReport.reports[0].report_json.clauses || []).map(c => ({
        ...c, clauseKey: `${latestReport.id}-${c.name}`, reportId: latestReport.reports[0].id
      }))
    : []

  useEffect(() => {
    if (allClauses.length > 0 && openClauseKey === null) {
      const firstHigh = allClauses.find(c => c.danger === 'HIGH')
      setOpenClauseKey(firstHigh?.clauseKey || allClauses[0]?.clauseKey)
      setActiveClause(allClauses.indexOf(firstHigh || allClauses[0]))
    }
  }, [allClauses.length])

  const highClauses = allClauses.filter(c => c.danger === 'HIGH')
  const medClauses  = allClauses.filter(c => c.danger === 'MEDIUM')
  const lowClauses  = allClauses.filter(c => c.danger === 'LOW')
  const counteing   = Object.values(decisions).filter(d => d === 'countering').length
  const agreed      = Object.values(decisions).filter(d => d === 'accepted').length
  const toDecide    = allClauses.length - counteing - agreed

  const filteredClauses = filter === 'All' ? allClauses
    : filter === 'To decide' ? allClauses.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')
    : filter === 'Countering' ? allClauses.filter(c => decisions[c.clauseKey] === 'countering')
    : allClauses.filter(c => decisions[c.clauseKey] === 'accepted')

  const riskColor  = { HIGH: 'var(--risk-h)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }
  const riskBg     = { HIGH: 'var(--risk-h-bg)', MEDIUM: 'var(--risk-m-bg)', LOW: 'var(--risk-l-bg)' }
  const riskBorder = { HIGH: 'var(--risk-h-border)', MEDIUM: 'var(--risk-m-border)', LOW: 'var(--risk-l-border)' }
  const lcIndex    = { reviewing: 0, counter_prepared: 1, sent: 2, awaiting: 3, agreed: 4 }

  if (loading) return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main"><div className={styles.loading}><div className={styles.ring} /></div></main>
    </div>
  )

  const activeC = allClauses[activeClause]

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
                {ws && <><button onClick={() => navigate(`/workspace/${neg.workspace_id}`)}>{ws.name}</button><span>›</span></>}
                <span>{stripTimestamp(neg?.property_name) || 'Negotiation'}</span>
              </div>
              <h1 className={styles.h1}>{stripTimestamp(neg?.property_name) || 'Unnamed negotiation'}</h1>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <span className={`${styles.statusChip} ${highClauses.length > 0 ? styles.chipHigh : styles.chipOk}`}>
              ● {highClauses.length > 0 ? 'Needs attention' : 'Reviewing'}
            </span>
            {docs.length >= 2 && (
              <button className="btn-outline btn-sm" onClick={() => navigate(`/compare/${negId}`)}>Compare versions</button>
            )}
            <button className="btn-gold btn-sm" onClick={handleAnalyseVersion}><PlusIcon /> Add version</button>
          </div>
        </div>

        {/* STAT BAR */}
        <div className={styles.statBar}>
          {[
            { label: 'VERSIONS', value: docs.length, sub: 'uploaded' },
            { label: 'CLAUSES FLAGGED', value: allClauses.length, sub: 'total' },
            { label: 'HIGH PRIORITY', value: highClauses.length, sub: '', color: 'var(--risk-h)' },
            { label: 'TO DECIDE', value: toDecide, sub: 'remaining' },
          ].map((s, i) => (
            <div key={i} className={styles.statItem}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statValue} style={s.color ? { color: s.color } : {}}>{s.value}</div>
              {s.sub && <div className={styles.statSub}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* LIFECYCLE RAIL */}
        <div className={styles.lifecycleBar}>
          <div className={styles.lcLabel}>Negotiation status</div>
          <div className={styles.rail}>
            {LIFECYCLE.map((s, i) => {
              const cur = lcIndex[lifecycle] ?? 0
              const done = i < cur
              const active = i === cur
              const clickable = ['sent', 'awaiting', 'agreed'].includes(LC_KEYS[i]) && i >= cur
              return (
                <div key={s} className={`${styles.stage} ${done ? styles.stageDone : active ? styles.stageCurrent : styles.stageUpcoming} ${clickable ? styles.stageClick : ''}`}
                  onClick={() => clickable && updateLifecycle(LC_KEYS[i])}>
                  <div className={styles.stageNode}>
                    {done && <CheckIcon />}
                  </div>
                  <div className={styles.stageLine} />
                  <div className={styles.stageNm}>{s}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.mainLayout}>

            {/* LEFT — clause list */}
            <div className={styles.clauseList}>
              <div className={styles.clHead}>
                <div className={styles.clTitle}>
                  <h3>Negotiation list</h3>
                  <span className={styles.clCount}>· {allClauses.length} clauses</span>
                </div>
                <div className={styles.filterRow}>
                  {['All', 'To decide', 'Countering', 'Agreed'].map(f => (
                    <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                      onClick={() => setFilter(f)}>
                      {f} {f === 'All' ? allClauses.length : f === 'To decide' ? toDecide : f === 'Countering' ? counteing : agreed}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.clauseItems}>
                {/* Group by risk */}
                {['HIGH', 'MEDIUM', 'LOW'].map(risk => {
                  const group = filteredClauses.filter(c => c.danger === risk)
                  if (group.length === 0) return null
                  return (
                    <div key={risk}>
                      <div className={styles.groupHead}>
                        {risk === 'HIGH' ? 'High priority' : risk === 'MEDIUM' ? 'Medium' : 'Low / standard'}
                        <span> · {group.length}</span>
                      </div>
                      {group.map((c, i) => {
                        const dec = decisions[c.clauseKey] || 'open'
                        const isActive = activeClause === allClauses.indexOf(c)
                        return (
                          <div key={c.clauseKey}
                            className={`${styles.clauseItem} ${isActive ? styles.clauseActive : ''}`}
                            onClick={() => setActiveClause(allClauses.indexOf(c))}>
                            <div className={styles.ciBar} style={{ background: riskColor[c.danger] }} />
                            <div className={styles.ciContent}>
                              <div className={styles.ciRef}>{c.location || `Clause — ${risk}`}</div>
                              <div className={styles.ciName}>{c.name}</div>
                            </div>
                            <div className={styles.ciRight}>
                              {dec === 'countering' && <span className={styles.decCountering}>Countering</span>}
                              {dec === 'accepted' && <span className={styles.decAgreed}>Agreed</span>}
                              {dec === 'open' && <span className={styles.decOpen}>Needs decision</span>}
                              <ChevIcon />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {filteredClauses.length === 0 && (
                  <div className={styles.emptyFilter}>No clauses in this filter.</div>
                )}
              </div>
            </div>

            {/* CENTRE — clause detail */}
            <div className={styles.clauseDetail}>
              {activeC ? (
                <>
                  <div className={styles.cdHead}>
                    <div>
                      <div className={styles.cdRef}>{activeC.location}</div>
                      <h2 className={styles.cdName}>{activeC.name}</h2>
                    </div>
                    <span className={styles.cdRisk} style={{
                      background: riskBg[activeC.danger],
                      color: riskColor[activeC.danger],
                      border: `1px solid ${riskBorder[activeC.danger]}`
                    }}>{activeC.danger} PRIORITY</span>
                  </div>

                  {activeC.quote && (
                    <div className={styles.quoteBlock}>
                      <div className={styles.quoteLabel}>Clause wording · {activeC.location}</div>
                      <p>"{activeC.quote}"</p>
                    </div>
                  )}

                  {activeC.risk && (
                    <div className={styles.analysisBlock}>
                      <div className={styles.blockLabel}>What it means for you</div>
                      <p>{activeC.risk}</p>
                    </div>
                  )}

                  {activeC.counter && (
                    <div className={`${styles.analysisBlock} ${styles.counterBlock}`}>
                      <div className={styles.blockLabel} style={{color:'var(--gold)'}}>Suggested counter</div>
                      <p>{activeC.counter}</p>
                    </div>
                  )}

                  {activeC.legislation && (
                    <div className={`${styles.analysisBlock} ${styles.legBlock}`}>
                      <div className={styles.blockLabel} style={{color:'var(--risk-l)'}}>Relevant legislation</div>
                      <p>{activeC.legislation}</p>
                    </div>
                  )}

                  {/* Decision buttons */}
                  <div className={styles.decisionRow}>
                    <button
                      className={`${styles.decBtn} ${decisions[activeC.clauseKey] === 'accepted' ? styles.decBtnActive : ''}`}
                      onClick={() => toggleDecision(activeC.clauseKey, 'accepted', activeC.name)}>
                      <CheckIcon /> Agree to clause
                    </button>
                    <button
                      className={`${styles.decBtn} ${styles.decBtnCounter} ${decisions[activeC.clauseKey] === 'countering' ? styles.decBtnCounterActive : ''}`}
                      onClick={() => toggleDecision(activeC.clauseKey, 'countering', activeC.name)}>
                      ← Counter this
                    </button>
                    <span className={styles.decNote}>
                      {savingDecision ? 'Saving…'
                        : decisions[activeC.clauseKey] === 'countering' ? 'Added to response brief'
                        : decisions[activeC.clauseKey] === 'accepted' ? 'Marked as agreed'
                        : 'Choose how to respond'}
                    </span>
                    {latestReport?.reports?.[0]?.id && (
                      <button className={styles.viewReportBtn}
                        onClick={() => navigate(`/report/${latestReport.reports[0].id}`)}>
                        View full report →
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.cdEmpty}>
                  <DocIcon />
                  <p>Select a clause from the list to view details</p>
                </div>
              )}
            </div>

            {/* RIGHT — sidebar */}
            <div className={styles.sideCol}>

              {/* Response brief */}
              <div className={styles.briefCard}>
                <h3 className={styles.sCardTitle}>Your Response Brief</h3>
                <div className={styles.briefStats}>
                  <div className={styles.briefStat}>
                    <div className={styles.bsNum}>{counteing}</div>
                    <div className={styles.bsLabel}>Countering</div>
                  </div>
                  <div className={styles.briefStat}>
                    <div className={styles.bsNum}>{agreed}</div>
                    <div className={styles.bsLabel}>Agreed</div>
                  </div>
                  <div className={styles.briefStat}>
                    <div className={styles.bsNum} style={{color:'var(--risk-h)'}}>{toDecide}</div>
                    <div className={styles.bsLabel}>To decide</div>
                  </div>
                </div>
                <p className={styles.briefDesc}>
                  {toDecide > 0
                    ? `${toDecide} clause${toDecide !== 1 ? 's' : ''} still need a decision.`
                    : 'All clauses reviewed. Ready to generate response.'}
                </p>
                <button className={styles.generateBtn}
                  onClick={() => navigate(`/report/${latestReport?.reports?.[0]?.id}`)}>
                  Generate response for agent →
                </button>
              </div>

              {/* Documents */}
              <div className={styles.sCard}>
                <div className={styles.sCardHead}>
                  <h3 className={styles.sCardTitle}>Documents</h3>
                  <button className={styles.addDocBtn} onClick={handleAnalyseVersion}><PlusIcon /> Add</button>
                </div>
                <div className={styles.docList}>
                  {docs.map((doc, i) => (
                    <div key={doc.id} className={styles.docRow}>
                      <div className={styles.docFileIcon}>
                        {doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}
                      </div>
                      <div className={styles.docInfo}>
                        <div className={styles.docVer}>V{doc.version_number} {i === 0 ? '· Current' : ''}</div>
                        <div className={styles.docName}>{stripTimestamp(doc.filename)}</div>
                      </div>
                      {doc.overall_risk && (
                        <span className={styles.docRisk} style={{
                          background: riskBg[doc.overall_risk],
                          color: riskColor[doc.overall_risk]
                        }}>{doc.overall_risk}</span>
                      )}
                      {doc.reports?.[0]?.id && (
                        <button className={styles.docReportBtn}
                          onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                          Report →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {docs.length >= 2 && (
                  <button className={styles.compareBtn}
                    onClick={() => navigate(`/compare/${negId}`)}>
                    Compare versions →
                  </button>
                )}
              </div>

              {/* Risk summary */}
              <div className={styles.sCard}>
                <h3 className={styles.sCardTitle}>Risk Summary</h3>
                <div className={styles.riskRows}>
                  {[
                    { label: 'High priority', count: highClauses.length, color: 'var(--risk-h)' },
                    { label: 'Medium', count: medClauses.length, color: 'var(--risk-m)' },
                    { label: 'Low / standard', count: lowClauses.length, color: 'var(--risk-l)' },
                  ].map(r => (
                    <div key={r.label} className={styles.riskRow}>
                      <div className={styles.rrDot} style={{background: r.color}} />
                      <div className={styles.rrLabel}>{r.label}</div>
                      <div className={styles.rrCount} style={{color: r.color}}>{r.count}</div>
                    </div>
                  ))}
                </div>
                <p className={styles.disclaimer}>LeaseLens provides informational analysis to support negotiation and does not constitute legal advice.</p>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
