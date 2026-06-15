import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './NegotiationDetail.module.css'
import briefStyles from './ResponseBriefModal.module.css'

const LIFECYCLE = ['Reviewing', 'Counter prepared', 'Sent to agent', 'Awaiting response', 'Agreed']

export default function ReviewTab({ negId, neg, ws, docs }) {
  const navigate = useNavigate()
  const [decisions, setDecisions]         = useState({})
  const [lifecycle, setLifecycle]         = useState(neg?.lifecycle || 'reviewing')
  const [savingDecision, setSavingDecision] = useState(false)
  const [openClauseKey, setOpenClauseKey] = useState(null)
  const [filter, setFilter]               = useState('all')

  // Brief modal state
  const [briefOpen, setBriefOpen]   = useState(false)
  const [briefText, setBriefText]   = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]         = useState(false)

  useEffect(() => {
    if (!negId) return
    supabase
      .from('clause_decisions')
      .select('clause_key, decision')
      .eq('negotiation_id', negId)
      .then(({ data }) => {
        if (data?.length) {
          const decMap = {}
          data.forEach(d => { decMap[d.clause_key] = d.decision })
          setDecisions(decMap)
        }
      })
  }, [negId])

  const toggleDecision = async (clauseKey, action, clauseName) => {
    const newDecision = decisions[clauseKey] === action ? 'open' : action
    const newDecisions = { ...decisions, [clauseKey]: newDecision }
    setDecisions(newDecisions)
    setSavingDecision(true)
    try {
      if (newDecision === 'open') {
        await supabase.from('clause_decisions')
          .delete()
          .eq('negotiation_id', negId)
          .eq('clause_key', clauseKey)
      } else {
        await supabase.from('clause_decisions')
          .upsert({
            negotiation_id: negId,
            clause_key: clauseKey,
            clause_name: clauseName,
            decision: newDecision,
          }, { onConflict: 'negotiation_id,clause_key' })
      }
      const hasCountering = Object.values(newDecisions).some(d => d === 'countering')
      const autoLifecycle = hasCountering ? 'counter_prepared' : 'reviewing'
      if (['reviewing', 'counter_prepared'].includes(lifecycle)) {
        await updateLifecycle(autoLifecycle)
      }
    } catch (e) {
      console.error('Failed to save decision:', e)
    }
    setSavingDecision(false)
  }

  const updateLifecycle = async (newStage) => {
    setLifecycle(newStage)
    await supabase.from('negotiations').update({ lifecycle: newStage }).eq('id', negId)
  }

  const riskColor = { HIGH: 'var(--accent)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }

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

  const filterClauses = (list) => {
    if (filter === 'countering') return list.filter(c => decisions[c.clauseKey] === 'countering')
    if (filter === 'agreed')     return list.filter(c => decisions[c.clauseKey] === 'accepted')
    if (filter === 'open')       return list.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')
    return list
  }

  useEffect(() => {
    if (allClauses.length > 0 && openClauseKey === null) {
      const firstHigh = allClauses.find(c => c.danger === 'HIGH')
      setOpenClauseKey(firstHigh?.clauseKey || allClauses[0]?.clauseKey || null)
    }
  }, [allClauses.length])

  // ── Generate response email──
  const handleGenerateBrief = () => {
    if (!countering.length) return
    setBriefOpen(true)
    setCopied(false)

    const propertyName = neg?.property_name || 'the above premises'
    const tenantName   = ws?.client_name || ''

    const clauseParas = countering.map(c => {
      const counterText = c.counter || c.risk || ''
      return `${c.name}\n${counterText}`
    }).join('\n\n')

    const intro = tenantName
      ? `Thank you for providing the heads of agreement for ${propertyName} on behalf of ${tenantName}. We have reviewed the terms and have the following comments:`
      : `Thank you for providing the heads of agreement for ${propertyName}. We have reviewed the terms and have the following comments:`

    const email = `Dear [Agent name],\n\n${intro}\n\n${clauseParas}\n\nWe look forward to your response.\n\nRegards,\n`

    setBriefText(email)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(briefText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const ClauseItem = ({ c }) => {
    const open = openClauseKey === c.clauseKey
    const dec  = decisions[c.clauseKey] || 'open'

    return (
      <div className={`${styles.negItem} ${open ? styles.negItemOpen : ''}`}>
        <div className={styles.negRow} onClick={() => setOpenClauseKey(prev => prev === c.clauseKey ? null : c.clauseKey)}>
          <span className={styles.prio} style={{ background: riskColor[c.danger] }} />
          <div className={styles.tt}>
            {c.location && <div className={styles.ref}>{c.location}</div>}
            <div className={styles.nm}>{c.name}</div>
          </div>
          {dec === 'countering' && <span className={`${styles.sbadge} ${styles.sCounter}`}><span className={styles.sdot} />Countering</span>}
          {dec === 'accepted'   && <span className={`${styles.sbadge} ${styles.sAgreed}`}><span className={styles.sdot} />You agreed</span>}
          {dec === 'open'       && <span className={`${styles.sbadge} ${styles.sOpen}`}><span className={styles.sdot} />Needs decision</span>}
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
                onClick={e => { e.stopPropagation(); toggleDecision(c.clauseKey, 'accepted', c.name) }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Agree to clause
              </button>
              <button
                className={`${styles.dcBtn} ${styles.dcCounter} ${dec === 'countering' ? styles.dcOn : ''}`}
                onClick={e => { e.stopPropagation(); toggleDecision(c.clauseKey, 'countering', c.name) }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M10 4L6 8l4 4M6 8h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Counter this
              </button>
              <span className={styles.decideNote}>
                {savingDecision ? 'Saving…' : dec === 'countering' ? 'Added to response brief' : dec === 'accepted' ? 'Marked as agreed' : 'Choose how to respond'}
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

  const filteredHigh = filterClauses(highClauses)
  const filteredMed  = filterClauses(medClauses)
  const filteredLow  = filterClauses(lowClauses)

  return (
    <>
      <div className={styles.wsBody}>
        <div className={styles.colMain}>

          {/* FACTS STRIP */}
          {allClauses.length > 0 && (
            <div className={styles.facts}>
              <div className={styles.fact}><div className={styles.factL}>Versions</div><div className={styles.factV}>{docs.length} <small>uploaded</small></div></div>
              <div className={styles.factDiv} />
              <div className={styles.fact}><div className={styles.factL}>Clauses flagged</div><div className={styles.factV}>{allClauses.length} <small>total</small></div></div>
              <div className={styles.factDiv} />
              <div className={styles.fact}><div className={styles.factL}>High priority</div><div className={styles.factV} style={{ color: 'var(--accent)' }}>{highClauses.length}</div></div>
              <div className={styles.factDiv} />
              <div className={styles.fact}><div className={styles.factL}>To decide</div><div className={styles.factV}>{toDecide.length} <small>remaining</small></div></div>
            </div>
          )}

          {/* LIFECYCLE */}
          <div className={styles.lifecycle}>
            <div className={styles.lcTop}>
              <span className={styles.lcT}>Negotiation status</span>
              {lifecycle === 'counter_prepared' && <span className={styles.lcNext}>Next: <b>send counters to agent</b></span>}
              {lifecycle === 'sent'             && <span className={styles.lcNext}>Waiting for landlord response</span>}
              {lifecycle === 'awaiting'         && <span className={styles.lcNext}>Chase if no response within 5 business days</span>}
              {lifecycle === 'agreed'           && <span className={styles.lcNext} style={{ color: 'var(--risk-l)' }}>✓ Negotiation complete</span>}
            </div>
            <div className={styles.rail}>
              {LIFECYCLE.map((s, i) => {
                const lcIndex = { reviewing: 0, counter_prepared: 1, sent: 2, awaiting: 3, agreed: 4 }
                const cur = lcIndex[lifecycle] ?? 0
                const cls = i < cur ? styles.stageDone : i === cur ? styles.stageCurrent : styles.stageUpcoming
                const stageKey = ['reviewing', 'counter_prepared', 'sent', 'awaiting', 'agreed'][i]
                const isClickable = ['sent', 'awaiting', 'agreed'].includes(stageKey) && i >= cur
                return (
                  <div key={s}
                    className={`${styles.stage} ${cls} ${isClickable ? styles.stageClickable : ''}`}
                    onClick={() => isClickable && updateLifecycle(stageKey)}>
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

          {/* CLAUSE LIST */}
          {allClauses.length > 0 ? (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Clauses <span className={styles.ct}>· {allClauses.length}</span></h2>
                <div className={styles.statFilter}>
                  {[
                    { key: 'all',        label: 'All',        count: allClauses.length },
                    { key: 'open',       label: 'To decide',  count: toDecide.length },
                    { key: 'countering', label: 'Countering', count: countering.length },
                    { key: 'agreed',     label: 'Agreed',     count: agreed.length },
                  ].map(f => (
                    <button
                      key={f.key}
                      className={`${styles.sfBtn} ${filter === f.key ? styles.sfActive : ''}`}
                      onClick={() => setFilter(f.key)}>
                      {f.label} <span className={styles.c}>{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.panelBody}>
                {filteredHigh.length > 0 && (
                  <div className={styles.negGroup}>
                    <div className={styles.gh}>High priority <span className={styles.gc}>· {filteredHigh.length}</span></div>
                    {filteredHigh.map(c => <ClauseItem key={c.clauseKey} c={c} />)}
                  </div>
                )}
                {filteredMed.length > 0 && (
                  <div className={styles.negGroup}>
                    <div className={styles.gh}>Medium <span className={styles.gc}>· {filteredMed.length}</span></div>
                    {filteredMed.map(c => <ClauseItem key={c.clauseKey} c={c} />)}
                  </div>
                )}
                {filteredLow.length > 0 && (
                  <div className={styles.negGroup}>
                    <div className={styles.gh}>Low / standard <span className={styles.gc}>· {filteredLow.length}</span></div>
                    {filteredLow.map(c => <ClauseItem key={c.clauseKey} c={c} />)}
                  </div>
                )}
                {filteredHigh.length === 0 && filteredMed.length === 0 && filteredLow.length === 0 && (
                  <div className={styles.empty}>No clauses in this filter.</div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.panel}>
              <div className={styles.panelHead}><h2>Clauses</h2></div>
              <div className={styles.empty}>No report yet — analyse a document to see clauses here.</div>
            </div>
          )}
        </div>

        {/* STICKY RAIL */}
        <div className={styles.railSide}>
          <div className={styles.nextCard}>
            <h3>Response brief</h3>
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
              <p>Agree or counter each clause and LeaseLens builds the response to send to the agent.</p>
            )}
            {toDecide.length > 0 && (
              <p style={{ fontSize: 13, color: 'rgba(243,240,232,.7)', marginTop: 8 }}>
                {toDecide.length} clause{toDecide.length > 1 ? 's' : ''} still need{toDecide.length === 1 ? 's' : ''} a decision.
              </p>
            )}
            <button
              className={styles.briefBtn}
              disabled={countering.length === 0}
              onClick={handleGenerateBrief}>
              Generate response for agent →
            </button>
          </div>

          {allClauses.length > 0 && (
            <div className={styles.sCard}>
              <h3>Risk summary</h3>
              <div className={styles.riskLegend}>
                {[
                  { label: 'High priority',  count: highClauses.length, color: 'var(--accent)' },
                  { label: 'Medium',         count: medClauses.length,  color: 'var(--risk-m)' },
                  { label: 'Low / standard', count: lowClauses.length,  color: 'var(--risk-l)' },
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

          <p className={styles.disclaimer}>LeaseLens provides informational analysis and does not constitute legal advice.</p>
        </div>
      </div>

      {/* RESPONSE BRIEF MODAL */}
      {briefOpen && (
        <div className={briefStyles.overlay} onClick={() => !generating && setBriefOpen(false)}>
          <div className={briefStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={briefStyles.modalHead}>
              <div>
                <div className={briefStyles.kicker}>Response brief</div>
                <h2 className={briefStyles.title}>Email to agent</h2>
              </div>
              <button className={briefStyles.closeBtn} onClick={() => setBriefOpen(false)}>✕</button>
            </div>
              <>
                <div className={briefStyles.hint}>
                  Review and edit before sending. Replace [Agent name] with the agent's name.
                </div>
                <textarea
                  className={briefStyles.emailBody}
                  value={briefText}
                  onChange={e => setBriefText(e.target.value)}
                  rows={18}
                />
                <div className={briefStyles.modalFoot}>
                  <button className={briefStyles.regenerateBtn} onClick={handleGenerateBrief}>
                    Regenerate
                  </button>
                  <button className={briefStyles.copyBtn} onClick={handleCopy}>
                    {copied ? '✓ Copied!' : 'Copy email'}
                  </button>
                </div>
              </>
          </div>
        </div>
      )}
    </>
  )
}
