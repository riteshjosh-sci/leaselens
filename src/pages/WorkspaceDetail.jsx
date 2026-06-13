import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './WorkspaceDetail.module.css'

// Viewfinder mark inline
const Mark = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ color }}>
    <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    <circle cx="20" cy="20" r="5.4" fill="currentColor"/>
  </svg>
)

const LIFECYCLE = ['Reviewing', 'Counter prepared', 'Sent to agent', 'Awaiting response', 'Agreed']

export default function WorkspaceDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ws, setWs] = useState(null)
  const [negotiations, setNeg] = useState([])
  const [logoUrl, setLogoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState(null)
  const [renameVal, setRenameVal] = useState('')
  const [expanded, setExpanded] = useState({})
  // Clause decisions: { [clauseKey]: 'open' | 'countering' | 'accepted' }
  const [decisions, setDecisions] = useState({})
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
  }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('negotiations').select(`
        id, property_name, created_at, status,
        documents (
          id, filename, version_number, uploaded_at, overall_risk, file_path,
          reports ( id, report_json )
        )
      `).eq('workspace_id', id).order('created_at', { ascending: false }),
    ])

    if (wsRes.error || !wsRes.data) { navigate('/dashboard'); return }
    setWs(wsRes.data)
    const negs = negsRes.data || []
    setNeg(negs)
    if (negs.length > 0) setExpanded({ [negs[0].id]: true })

    if (wsRes.data.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(wsRes.data.logo_path)
      setLogoUrl(urlData?.publicUrl || null)
    }
    setLoading(false)
  }

  const getMetaForNeg = async (negId) => {
    const { data } = await supabase
      .from('jobs')
      .select('asset_class, property_type, landlord_type, suburb, postcode')
      .eq('negotiation_id', negId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return data || {}
  }

  const handleAnalyseNew = async () => {
    const lastNeg = negotiations[0]
    let meta = {}
    if (lastNeg) meta = await getMetaForNeg(lastNeg.id)
    navigate('/analyser', { state: { workspaceId: id, prefill: meta } })
  }

  const handleAnalyseVersion = async (negId) => {
    const meta = await getMetaForNeg(negId)
    navigate('/analyser', { state: { negotiationId: negId, workspaceId: id, prefill: meta } })
  }

  const handleRename = async (negId) => {
    if (!renameVal.trim()) return
    await supabase.from('negotiations').update({ property_name: renameVal.trim() }).eq('id', negId)
    setNeg(prev => prev.map(n => n.id === negId ? { ...n, property_name: renameVal.trim() } : n))
    setRenaming(null)
  }

  const handleDeleteNeg = async (negId) => {
    if (!confirm('Delete this negotiation and all its documents? This cannot be undone.')) return
    const neg = negotiations.find(n => n.id === negId)
    const filePaths = (neg?.documents || []).map(d => d.file_path).filter(Boolean)
    if (filePaths.length) await supabase.storage.from('documents').remove(filePaths)
    await supabase.from('jobs').delete().eq('negotiation_id', negId)
    await supabase.from('negotiations').delete().eq('id', negId)
    setNeg(prev => prev.filter(n => n.id !== negId))
  }

  const handleDeleteDoc = async (docId, filePath, negId) => {
    if (!confirm('Delete this document and its report?')) return
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    await supabase.from('reports').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    setNeg(prev => prev.map(n => n.id !== negId ? n : {
      ...n, documents: n.documents.filter(d => d.id !== docId)
    }))
  }

  const toggleDecision = (clauseKey, action) => {
    setDecisions(prev => ({
      ...prev,
      [clauseKey]: prev[clauseKey] === action ? 'open' : action
    }))
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const riskColor = { HIGH: 'var(--accent)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }
  const riskPillCls = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }

  // Extract all clauses from all docs across all negotiations
  const allClauses = negotiations.flatMap(neg =>
    (neg.documents || []).flatMap(doc =>
      (doc.reports?.[0]?.report_json?.clauses || []).map(c => ({
        ...c,
        docId: doc.id,
        negId: neg.id,
        negName: neg.property_name,
        reportId: doc.reports[0].id,
        version: doc.version_number,
        clauseKey: `${doc.id}-${c.name}`,
      }))
    )
  )

  const highClauses = allClauses.filter(c => c.danger === 'HIGH')
  const medClauses  = allClauses.filter(c => c.danger === 'MEDIUM')
  const lowClauses  = allClauses.filter(c => c.danger === 'LOW')

  const countering = allClauses.filter(c => decisions[c.clauseKey] === 'countering')
  const agreed     = allClauses.filter(c => decisions[c.clauseKey] === 'accepted')
  const toDecide   = allClauses.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')

  const totalDocs = negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const highCount = negotiations.reduce((a, n) =>
    a + (n.documents || []).filter(d => d.overall_risk === 'HIGH').length, 0)

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  // Clause item component
  const ClauseItem = ({ c }) => {
    const [open, setOpen] = useState(c.danger === 'HIGH')
    const dec = decisions[c.clauseKey] || 'open'

    return (
      <div className={`${styles.negItem} ${open ? styles.negItemOpen : ''}`}
           data-prio={c.danger?.toLowerCase()}>
        <div className={styles.negRow} onClick={() => setOpen(o => !o)}>
          <span className={styles.prio} style={{ background: riskColor[c.danger] }} />
          <div className={styles.tt}>
            {c.location && <div className={styles.ref}>{c.location}</div>}
            <div className={styles.nm}>{c.name}</div>
          </div>
          {dec === 'countering' && (
            <span className={`${styles.sbadge} ${styles.sCounter}`}>
              <span className={styles.sdot} />Countering
            </span>
          )}
          {dec === 'accepted' && (
            <span className={`${styles.sbadge} ${styles.sAgreed}`}>
              <span className={styles.sdot} />You agreed
            </span>
          )}
          {dec === 'open' && (
            <span className={`${styles.sbadge} ${styles.sOpen}`}>
              <span className={styles.sdot} />Needs decision
            </span>
          )}
          <svg className={`${styles.chev} ${open ? styles.chevOpen : ''}`}
               width="18" height="18" viewBox="0 0 20 20" fill="none">
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

            {/* Decide buttons */}
            <div className={styles.decide} onClick={e => e.stopPropagation()}>
              <button
                className={`${styles.dcBtn} ${styles.dcAgree} ${dec === 'accepted' ? styles.dcOn : ''}`}
                onClick={() => toggleDecision(c.clauseKey, 'accepted')}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Agree to clause
              </button>
              <button
                className={`${styles.dcBtn} ${styles.dcCounter} ${dec === 'countering' ? styles.dcOn : ''}`}
                onClick={() => toggleDecision(c.clauseKey, 'countering')}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M10 4L6 8l4 4M6 8h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Counter this
              </button>
              <span className={styles.decideNote}>
                {dec === 'countering' ? 'Added to your response brief' : dec === 'accepted' ? 'Marked as agreed' : 'Choose how to respond'}
              </span>
            </div>

            <div className={styles.detailMeta}>
              <button className={styles.tinyLink} onClick={() => navigate(`/report/${c.reportId}`)}>
                View full report →
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.crumb}>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <span>›</span>
          <span>{ws.name}</span>
        </div>

        {/* WORKSPACE HEADER */}
        <div className={styles.wsHead}>
          <div className={styles.wsId}>
            {logoUrl
              ? <img src={logoUrl} alt="logo" className={styles.wsLogo} />
              : <div className={styles.wsBadge}>{ws.name[0]?.toUpperCase()}</div>
            }
            <div>
              <div className={styles.wsKicker}>Workspace · Property</div>
              <h1 className={styles.wsName}>{ws.name}</h1>
              {ws.client_name && (
                <div className={styles.wsSub}>{ws.client_name}</div>
              )}
            </div>
          </div>
          <div className={styles.wsActions}>
            <span className={styles.statusChip}>
              <span className={styles.statusD} />
              {highCount > 0 ? 'Needs attention' : 'Reviewing'}
            </span>
            <button className="btn-outline btn-sm"
              onClick={() => navigate(`/workspace/${id}/settings`)}>
              Settings
            </button>
            <button className="btn-ink btn-sm" onClick={handleAnalyseNew}>
              + Analyse document
            </button>
          </div>
        </div>

        {/* DEAL FACTS STRIP */}
        {allClauses.length > 0 && (
          <div className={styles.facts}>
            <div className={styles.fact}>
              <div className={styles.factL}>Negotiations</div>
              <div className={styles.factV}>{negotiations.length} <small>active</small></div>
            </div>
            <div className={styles.factDiv} />
            <div className={styles.fact}>
              <div className={styles.factL}>Documents</div>
              <div className={styles.factV}>{totalDocs} <small>analysed</small></div>
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

        {/* LIFECYCLE RAIL */}
        <div className={styles.lifecycle}>
          <div className={styles.lcTop}>
            <span className={styles.lcT}>Negotiation status</span>
            {countering.length > 0 && (
              <span className={styles.lcNext}>Next: <b>send counters to agent</b></span>
            )}
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

        {/* MAIN BODY — two column cockpit */}
        <div className={styles.wsBody}>
          <div className={styles.colMain}>

            {/* NEGOTIATION LIST — from report data */}
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
                      <button key={f.key}
                        className={filter === f.key ? styles.sfActive : ''}
                        onClick={() => setFilter(f.key)}>
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
              /* NEGOTIATION LIST — no clauses yet, show doc list */
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2>Negotiations</h2>
                  <button className="btn-ink btn-sm btn-xs" onClick={handleAnalyseNew}>+ Analyse document</button>
                </div>
                <div className={styles.panelBody}>
                  {negotiations.length === 0 ? (
                    <div className={styles.empty}>
                      <p>No documents yet. Analyse a lease or HOA to get started.</p>
                      <button className="btn-ink btn-sm" onClick={handleAnalyseNew} style={{ marginTop: 16 }}>
                        Analyse document →
                      </button>
                    </div>
                  ) : negotiations.map((neg, idx) => {
                    const docs = (neg.documents || []).sort((a, b) => b.version_number - a.version_number)
                    const isOpen = !!expanded[neg.id]
                    return (
                      <div key={neg.id} className={`${styles.negItem} ${isOpen ? styles.negItemOpen : ''}`}>
                        <div className={styles.negRow} onClick={() => setExpanded(p => ({ ...p, [neg.id]: !p[neg.id] }))}>
                          <div className={styles.negIdx}>{String(idx + 1).padStart(2, '0')}</div>
                          <div className={styles.tt}>
                            <div className={styles.nm}>{neg.property_name || 'Unnamed'}</div>
                            <div className={styles.ref}>{formatDate(neg.created_at)} · {docs.length} version{docs.length !== 1 ? 's' : ''}</div>
                          </div>
                          <div className={styles.negControls} onClick={e => e.stopPropagation()}>
                            <button className={styles.ctrlBtn} onClick={() => handleAnalyseVersion(neg.id)}>+ Version</button>
                            <button className={styles.ctrlBtn} onClick={() => { setRenaming(neg.id); setRenameVal(neg.property_name || '') }}>Rename</button>
                            <button className={styles.ctrlDanger} onClick={() => handleDeleteNeg(neg.id)}>✕</button>
                          </div>
                          <svg className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`} width="18" height="18" viewBox="0 0 20 20" fill="none">
                            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        {isOpen && (
                          <div className={styles.docSection}>
                            {renaming === neg.id && (
                              <div className={styles.renameRow} style={{ padding: '12px 22px' }}>
                                <input className="input" value={renameVal}
                                  onChange={e => setRenameVal(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleRename(neg.id)}
                                  autoFocus style={{ maxWidth: 300 }} />
                                <button className="btn-primary btn-xs" onClick={() => handleRename(neg.id)}>Save</button>
                                <button className="btn-ghost btn-xs" onClick={() => setRenaming(null)}>Cancel</button>
                              </div>
                            )}
                            {docs.map((doc, di) => (
                              <div key={doc.id} className={`${styles.docRow} ${di === 0 ? styles.docRowLatest : ''}`}>
                                <div className={styles.fic}>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
                                <div className={styles.dm}>
                                  <div className={styles.docRole}>v{doc.version_number}</div>
                                  <div className={styles.docFn}>{stripTimestamp(doc.filename)}</div>
                                  <div className={styles.docVmeta}>{formatDate(doc.uploaded_at)}</div>
                                </div>
                                {doc.overall_risk && (
                                  <span className={`${styles.pill} ${riskPillCls[doc.overall_risk]}`}>
                                    {doc.overall_risk}
                                  </span>
                                )}
                                <div className={styles.docActions}>
                                  {doc.reports?.[0]?.id ? (
                                    <button className="btn-primary btn-xs" onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                                      View report →
                                    </button>
                                  ) : (
                                    <span className={styles.processing}>Processing…</span>
                                  )}
                                  <button className={styles.docDel} onClick={() => handleDeleteDoc(doc.id, doc.file_path, neg.id)}>✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                      <span className={styles.bd} />
                      {c.name}
                    </div>
                  ))}
                </div>
              ) : (
                <p>Agree or counter each clause and LeaseLens builds the response to send back to the agent.</p>
              )}
              {toDecide.length > 0 && (
                <p style={{ fontSize: 13, color: 'rgba(243,240,232,0.7)', marginTop: 8 }}>
                  {toDecide.length} clause{toDecide.length > 1 ? 's' : ''} still {toDecide.length > 1 ? 'need' : 'needs'} a decision.
                </p>
              )}
              <button className={styles.briefBtn} disabled={countering.length === 0}>
                Generate response for agent →
              </button>
            </div>

            {/* DOCUMENTS */}
            <div className={styles.sCard}>
              <h3>Documents <span className={styles.mv} onClick={handleAnalyseNew} style={{ cursor: 'pointer' }}>+ Add</span></h3>
              <div className={styles.docs}>
                {negotiations.flatMap(neg =>
                  (neg.documents || []).sort((a, b) => b.version_number - a.version_number).map(doc => (
                    <div key={doc.id} className={styles.docrow}>
                      <div className={styles.ficSm}>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
                      <div className={styles.dm}>
                        <div className={styles.docRole}>{neg.property_name || 'Document'} · v{doc.version_number}</div>
                        <div className={styles.docVmeta}>{stripTimestamp(doc.filename)}</div>
                      </div>
                      {doc.overall_risk && (
                        <span className={`${styles.pillSm} ${riskPillCls[doc.overall_risk]}`}>{doc.overall_risk}</span>
                      )}
                    </div>
                  ))
                )}
                {totalDocs === 0 && <p className={styles.emptyNote}>No documents yet.</p>}
              </div>
            </div>

            {/* RISK ROLLUP */}
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