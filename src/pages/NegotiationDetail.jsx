import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './NegotiationDetail.module.css'

const LIFECYCLE = ['Reviewing', 'Counter prepared', 'Sent to agent', 'Awaiting response', 'Agreed']

export default function NegotiationDetail() {
  const { id: negId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [neg, setNeg]         = useState(null)
  const [ws, setWs]           = useState(null)
  const [docs, setDocs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState({})

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
  }, [negId, user])

  const fetchAll = async () => {
    const { data: negData, error } = await supabase
      .from('negotiations')
      .select(`
        id, property_name, created_at, status, workspace_id,
        documents (
          id, filename, version_number, uploaded_at, overall_risk, file_path,
          reports ( id, report_json )
        )
      `)
      .eq('id', negId)
      .single()

    if (error || !negData) { navigate('/dashboard'); return }
    setNeg(negData)

    const sortedDocs = (negData.documents || []).sort((a, b) => b.version_number - a.version_number)
    setDocs(sortedDocs)

    if (negData.workspace_id) {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('id, name, client_name, logo_path')
        .eq('id', negData.workspace_id)
        .single()
      setWs(wsData)
    }

    setLoading(false)
  }

  const toggleDecision = (clauseKey, action) => {
    setDecisions(prev => ({
      ...prev,
      [clauseKey]: prev[clauseKey] === action ? 'open' : action
    }))
  }

  const handleAnalyseVersion = () => {
    navigate('/analyser', { state: { negotiationId: negId, workspaceId: ws?.id } })
  }

  const handleDeleteDoc = async (docId, filePath) => {
    if (!confirm('Delete this document and its report?')) return
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    await supabase.from('reports').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const riskColor = { HIGH: 'var(--accent)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }
  const riskPillCls = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }

  // Get clauses from the latest doc that has a report
  const latestReport = docs.find(d => d.reports?.[0]?.report_json)
  const allClauses = latestReport
    ? (latestReport.reports[0].report_json.clauses || []).map(c => ({
        ...c,
        clauseKey: `${latestReport.id}-${c.name}`,
        reportId: latestReport.reports[0].id,
      }))
    : []

  const highClauses = allClauses.filter(c => c.danger === 'HIGH')
  const medClauses  = allClauses.filter(c => c.danger === 'MEDIUM')
  const lowClauses  = allClauses.filter(c => c.danger === 'LOW')
  const countering  = allClauses.filter(c => decisions[c.clauseKey] === 'countering')
  const agreed      = allClauses.filter(c => decisions[c.clauseKey] === 'accepted')
  const toDecide    = allClauses.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')
  const highCount   = docs.filter(d => d.overall_risk === 'HIGH').length

  // Lifted open state — only one clause open at a time
  const [openClauseKey, setOpenClauseKey] = useState(null)

  // Set first HIGH clause open on load
  useEffect(() => {
    if (allClauses.length > 0 && openClauseKey === null) {
      const firstHigh = allClauses.find(c => c.danger === 'HIGH')
      setOpenClauseKey(firstHigh?.clauseKey || allClauses[0]?.clauseKey || null)
    }
  }, [allClauses.length])

  // Clause item component
  const ClauseItem = ({ c }) => {
    const open = openClauseKey === c.clauseKey
    const dec = decisions[c.clauseKey] || 'open'

    const handleToggle = () => {
      setOpenClauseKey(prev => prev === c.clauseKey ? null : c.clauseKey)
    }

    return (
      <div className={`${styles.negItem} ${open ? styles.negItemOpen : ''}`}>
        <div className={styles.negRow} onClick={handleToggle}>
          <span className={styles.prio} style={{ background: riskColor[c.danger] }} />
          <div className={styles.tt}>
            {c.location && <div className={styles.ref}>{c.location}</div>}
            <div className={styles.nm}>{c.name}</div>
          </div>
          {dec === 'countering' && (
            <span className={`${styles.sbadge} ${styles.sCounter}`}><span className={styles.sdot} />Countering</span>
          )}
          {dec === 'accepted' && (
            <span className={`${styles.sbadge} ${styles.sAgreed}`}><span className={styles.sdot} />You agreed</span>
          )}
          {dec === 'open' && (
            <span className={`${styles.sbadge} ${styles.sOpen}`}><span className={styles.sdot} />Needs decision</span>
          )}
          <svg className={`${styles.chev} ${open ? styles.chevOpen : ''}`} width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {open && (
          <div className={styles.negDetail}>
            {c.quote && (
              <div className={styles.docQuote}>
                <span className={styles.qref}>Clause wording · {c.location}</span>
                "{c.quote}"
              </div>
            )}
            {c.risk && (
              <div className={styles.nb}>
                <div className={styles.nbH}>What it means for you</div>
                <p>{c.risk}</p>
              </div>
            )}
            {c.counter && (
              <div className={`${styles.nb} ${styles.nbCounter}`}>
                <div className={`${styles.nbH} ${styles.nbHAct}`}>Suggested counter</div>
                <p>{c.counter}</p>
              </div>
            )}
            {c.legislation && (
              <div className={`${styles.nb} ${styles.nbLeg}`}>
                <div className={styles.nbH}>Relevant legislation</div>
                <p>{c.legislation}</p>
              </div>
            )}
            <div className={styles.decide}>
              <button
                className={`${styles.dcBtn} ${styles.dcAgree} ${dec === 'accepted' ? styles.dcOn : ''}`}
                onClick={e => { e.stopPropagation(); toggleDecision(c.clauseKey, 'accepted') }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Agree to clause
              </button>
              <button
                className={`${styles.dcBtn} ${styles.dcCounter} ${dec === 'countering' ? styles.dcOn : ''}`}
                onClick={e => { e.stopPropagation(); toggleDecision(c.clauseKey, 'countering') }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M10 4L6 8l4 4M6 8h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Counter this
              </button>
              <span className={styles.decideNote}>
                {dec === 'countering' ? 'Added to response brief' : dec === 'accepted' ? 'Marked as agreed' : 'Choose how to respond'}
              </span>
            </div>
            <div className={styles.detailMeta}>
              <button className={styles.tinyLink}
                onClick={() => navigate(`/report/${c.reportId}`)}>
                View full report →
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.crumb}>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <span>›</span>
          {ws && <><button onClick={() => navigate(`/workspace/${ws.id}`)}>{ws.name}</button><span>›</span></>}
          <span>{neg.property_name || 'Negotiation'}</span>
        </div>

        {/* HEADER */}
        <div className={styles.wsHead}>
          <div className={styles.wsId}>
            <div className={styles.wsBadge}>{(neg.property_name || 'N')[0]?.toUpperCase()}</div>
            <div>
              <div className={styles.wsKicker}>Workspace · Property</div>
              <h1 className={styles.wsName}>{neg.property_name || 'Unnamed negotiation'}</h1>
              {ws?.client_name && <div className={styles.wsSub}>{ws.client_name}</div>}
            </div>
          </div>
          <div className={styles.wsActions}>
            <span className={`${styles.statusChip} ${highCount > 0 ? styles.statusRaise : ''}`}>
              <span className={styles.statusD} />
              {highCount > 0 ? 'Needs attention' : 'Reviewing'}
            </span>
            {docs.length >= 2 && (
              <button className="btn-outline btn-sm"
                onClick={() => navigate(`/compare/${negId}`)}>
                Compare versions
              </button>
            )}
            <button className="btn-outline btn-sm" onClick={handleAnalyseVersion}>
              + Add version
            </button>
          </div>
        </div>

        {/* DEAL FACTS */}
        {allClauses.length > 0 && (
          <div className={styles.facts}>
            <div className={styles.fact}>
              <div className={styles.factL}>Versions</div>
              <div className={styles.factV}>{docs.length} <small>uploaded</small></div>
            </div>
            <div className={styles.factDiv} />
            <div className={styles.fact}>
              <div className={styles.factL}>Clauses flagged</div>
              <div className={styles.factV}>{allClauses.length} <small>total</small></div>
            </div>
            <div className={styles.factDiv} />
            <div className={styles.fact}>
              <div className={styles.factL}>High priority</div>
              <div className={styles.factV} style={{ color: 'var(--accent)' }}>{highClauses.length}</div>
            </div>
            <div className={styles.factDiv} />
            <div className={styles.fact}>
              <div className={styles.factL}>To decide</div>
              <div className={styles.factV}>{toDecide.length} <small>remaining</small></div>
            </div>
          </div>
        )}

        {/* LIFECYCLE */}
        <div className={styles.lifecycle}>
          <div className={styles.lcTop}>
            <span className={styles.lcT}>Negotiation status</span>
            {countering.length > 0 && <span className={styles.lcNext}>Next: <b>send counters to agent</b></span>}
          </div>
          <div className={styles.rail}>
            {LIFECYCLE.map((s, i) => {
              const cur = countering.length > 0 ? 1 : 0
              const cls = i < cur ? styles.stageDone : i === cur ? styles.stageCurrent : styles.stageUpcoming
              return (
                <div key={s} className={`${styles.stage} ${cls}`}>
                  <div className={styles.stageLine} />
                  <div className={styles.stageNode}>
                    {i < cur && (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className={styles.stageNm}>{s}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* MAIN — two column */}
        <div className={styles.wsBody}>
          <div className={styles.colMain}>

            {/* CLAUSE LIST */}
            {allClauses.length > 0 ? (
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>Negotiation list <span className={styles.ct}>· {allClauses.length} clauses</span></h2>
                  <div className={styles.statFilter}>
                    {[
                      { key: 'all', label: 'All', count: allClauses.length },
                      { key: 'open', label: 'To decide', count: toDecide.length },
                      { key: 'countering', label: 'Countering', count: countering.length },
                      { key: 'agreed', label: 'Agreed', count: agreed.length },
                    ].map(f => (
                      <button key={f.key} className={styles.sfBtn}>
                        {f.label} <span className={styles.c}>{f.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.panelBody}>
                  {highClauses.length > 0 && (
                    <div className={styles.negGroup}>
                      <div className={styles.gh}>High priority <span className={styles.gc}>· {highClauses.length}</span></div>
                      {highClauses.map(c => <ClauseItem key={c.clauseKey} c={c} />)}
                    </div>
                  )}
                  {medClauses.length > 0 && (
                    <div className={styles.negGroup}>
                      <div className={styles.gh}>Medium <span className={styles.gc}>· {medClauses.length}</span></div>
                      {medClauses.map(c => <ClauseItem key={c.clauseKey} c={c} />)}
                    </div>
                  )}
                  {lowClauses.length > 0 && (
                    <div className={styles.negGroup}>
                      <div className={styles.gh}>Low / standard <span className={styles.gc}>· {lowClauses.length}</span></div>
                      {lowClauses.map(c => <ClauseItem key={c.clauseKey} c={c} />)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>Documents</h2>
                  <button className="btn-ink btn-sm btn-xs" onClick={handleAnalyseVersion}>+ Add version</button>
                </div>
                <div className={styles.panelBody}>
                  {docs.length === 0 ? (
                    <div className={styles.empty}>
                      <p>No documents yet.</p>
                      <button className="btn-ink btn-sm" style={{ marginTop: 16 }} onClick={handleAnalyseVersion}>
                        Analyse document →
                      </button>
                    </div>
                  ) : docs.map(doc => (
                    <div key={doc.id} className={styles.docRow}>
                      <div className={styles.fic}>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
                      <div className={styles.dm}>
                        <div className={styles.docRole}>Version {doc.version_number}</div>
                        <div className={styles.docFn}>{stripTimestamp(doc.filename)}</div>
                        <div className={styles.docVmeta}>{formatDate(doc.uploaded_at)}</div>
                      </div>
                      {doc.overall_risk && (
                        <span className={`${styles.pill} ${riskPillCls[doc.overall_risk]}`}>{doc.overall_risk}</span>
                      )}
                      <div className={styles.docActions}>
                        {doc.reports?.[0]?.id ? (
                          <button className="btn-primary btn-xs" onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                            View report →
                          </button>
                        ) : <span className={styles.processing}>Processing…</span>}
                        <button className={styles.docDel} onClick={() => handleDeleteDoc(doc.id, doc.file_path)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STICKY RAIL */}
          <div className={styles.railSide}>

            {/* RESPONSE BRIEF */}
            <div className={styles.nextCard}>
              <h3>Your response brief</h3>
              <div className={styles.briefCounts}>
                <div className={styles.bc}><div className={styles.bn}>{countering.length}</div><div className={styles.bl}>Countering</div></div>
                <div className={styles.bc}><div className={styles.bn}>{agreed.length}</div><div className={styles.bl}>Agreed</div></div>
                <div className={styles.bc}><div className={styles.bn}>{toDecide.length}</div><div className={styles.bl}>To decide</div></div>
              </div>
              {countering.length > 0 ? (
                <div className={styles.briefList}>
                  {countering.map(c => (
                    <div key={c.clauseKey} className={styles.bi}>
                      <span className={styles.bd} />{c.name}
                    </div>
                  ))}
                </div>
              ) : (
                <p>Agree or counter each clause and LeaseLens builds the response to send back to the agent.</p>
              )}
              {toDecide.length > 0 && (
                <p style={{ fontSize: 13, color: 'rgba(243,240,232,.7)', marginTop: 8 }}>
                  {toDecide.length} clause{toDecide.length > 1 ? 's' : ''} still need{toDecide.length === 1 ? 's' : ''} a decision.
                </p>
              )}
              <button className={styles.briefBtn} disabled={countering.length === 0}>
                Generate response for agent →
              </button>
            </div>

            {/* DOCUMENTS */}
            <div className={styles.sCard}>
              <h3>Documents <span className={styles.mv} onClick={handleAnalyseVersion} style={{ cursor: 'pointer' }}>+ Add</span></h3>
              <div className={styles.docs}>
                {docs.map((doc, di) => (
                  <div key={doc.id} className={styles.docrow}>
                    <div className={styles.ficSm}>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
                    <div className={styles.dm}>
                      <div className={styles.docRole}>v{doc.version_number} {di === 0 ? '· current' : ''}</div>
                      <div className={styles.docVmeta}>{stripTimestamp(doc.filename)}</div>
                    </div>
                    {doc.overall_risk && (
                      <span className={`${styles.pillSm} ${riskPillCls[doc.overall_risk]}`}>{doc.overall_risk}</span>
                    )}
                    {doc.reports?.[0]?.id && (
                      <button className={styles.viewReportBtn}
                        onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                        View report →
                      </button>
                    )}
                  </div>
                ))}
                {docs.length >= 2 && (
                  <button className={styles.compareBtn}
                    onClick={() => navigate(`/compare/${negId}`)}>
                    Compare versions →
                  </button>
                )}
                {docs.length === 0 && <p className={styles.emptyNote}>No documents yet.</p>}
              </div>
            </div>

            {/* RISK SUMMARY */}
            {allClauses.length > 0 && (
              <div className={styles.sCard}>
                <h3>Risk summary</h3>
                <div className={styles.riskLegend}>
                  {[
                    { label: 'High priority', count: highClauses.length, color: 'var(--accent)' },
                    { label: 'Medium', count: medClauses.length, color: 'var(--risk-m)' },
                    { label: 'Low / standard', count: lowClauses.length, color: 'var(--risk-l)' },
                  ].map(r => (
                    <div key={r.label} className={styles.rkRow}>
                      <span className={styles.rkDot} style={{ background: r.color }} />
                      <span className={styles.rkNm}>{r.label}</span>
                      <span className={styles.rkCt}>{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className={styles.disclaimer}>LeaseLens provides informational analysis to support negotiation and does not constitute legal advice.</p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}