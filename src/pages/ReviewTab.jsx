import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './NegotiationDetail.module.css'

// Parse counter text into labelled options if the AI provided multiple.
// Matches "Option A: ..." / "Option B: ..." or "1. ... 2. ..." patterns.
function parseOptions(text) {
  if (!text) return null

  // Normalise literal \n sequences that survive JSON serialisation
  const t = text.replace(/\\n/g, '\n')

  // "Option A:" / "Option B:" — handle markdown bold (**Option A:**) too
  const optionLetterRe = /\*{0,2}option\s+[A-Z]\*{0,2}\s*[:\-–]/i
  if (optionLetterRe.test(t)) {
    const parts = t.split(/\n*\*{0,2}option\s+[A-Z]\*{0,2}\s*[:\-–]\s*/i).filter(s => s.trim())
    if (parts.length >= 2) {
      return parts.map((p, i) => ({ label: `Option ${String.fromCharCode(65 + i)}`, text: p.trim() }))
    }
  }

  // "1." / "2." at start of line
  if (/(?:^|\n)\s*\d+\.\s+/.test(t)) {
    const all = t.split(/\n\s*(?=\d+\.\s)/).filter(s => s.trim())
    if (all.length >= 2) {
      return all.map((p, i) => ({ label: `Option ${i + 1}`, text: p.replace(/^\d+\.\s+/, '').trim() }))
    }
  }

  return null
}

// Uncontrolled contenteditable — avoids cursor-jumping on every keystroke
function EditableCounter({ clauseKey, text, resetKey, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.textContent !== text) {
      ref.current.textContent = text
    }
  }, [clauseKey, resetKey])
  return (
    <div
      className={styles.counterEdit}
      contentEditable
      suppressContentEditableWarning
      ref={ref}
      spellCheck
      onInput={(e) => onChange(e.currentTarget.textContent)}
    />
  )
}

const PRIO_COLOR = { HIGH: 'var(--accent)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }

const ChevLeft = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M13 8H3.5M7 4.5L3.5 8 7 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const ChevRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h9.5M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const CheckIcon = ({ s = 12 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3 8.2l3.2 3.2L13 4.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const CounterIcon = ({ s = 12 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M9.5 3.5L5 8l4.5 4.5M5 8h7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M11 2.5l2.5 2.5L5 13.5 2 14l.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)
const ResetIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M3 8a5 5 0 1 1 1.5 3.5M3 8V5m0 3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function ReviewTab({ negId, neg, ws, docs }) {
  const navigate = useNavigate()
  const [decisions, setDecisions]       = useState({})
  const [counterEdits, setCounterEdits] = useState({}) // user-edited counter text keyed by clauseKey
  const [resetKeys, setResetKeys]       = useState({})
  const [selectedOptions, setSelectedOptions] = useState({}) // clauseKey → option index
  const [subTab, setSubTab]             = useState('clauses') // 'clauses' | 'summary'
  const [activeId, setActiveId]         = useState(null)
  const [lifecycle, setLifecycle]       = useState(neg?.lifecycle || 'reviewing')
  const [copied, setCopied]             = useState(false)

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

  const latestReport = docs.find(d => d.reports?.[0]?.report_json)
  const allClauses = latestReport
    ? (latestReport.reports[0].report_json.clauses || []).map(c => ({
        ...c,
        clauseKey: `${latestReport.id}-${c.name}`,
        reportId: latestReport.reports[0].id,
      }))
    : []

  useEffect(() => {
    if (allClauses.length > 0 && !activeId) {
      const firstHigh = allClauses.find(c => c.danger === 'HIGH')
      setActiveId(firstHigh?.clauseKey || allClauses[0]?.clauseKey)
    }
  }, [allClauses.length])

  const getCounterText = (c) => counterEdits[c.clauseKey] ?? c.counter ?? ''
  const isEdited = (c) => {
    const edited = counterEdits[c.clauseKey]
    return edited !== undefined && edited.trim() !== (c.counter || '').trim()
  }

  const saveDecision = async (clauseKey, clauseName, newDecision) => {
    if (newDecision === 'open') {
      await supabase.from('clause_decisions')
        .delete().eq('negotiation_id', negId).eq('clause_key', clauseKey)
    } else {
      await supabase.from('clause_decisions')
        .upsert({ negotiation_id: negId, clause_key: clauseKey, clause_name: clauseName, decision: newDecision },
          { onConflict: 'negotiation_id,clause_key' })
    }
  }

  const updateLifecycle = async (newStage) => {
    setLifecycle(newStage)
    await supabase.from('negotiations').update({ lifecycle: newStage }).eq('id', negId)
  }

  const toggleDecision = async (clauseKey, action, clauseName) => {
    const newDecision = decisions[clauseKey] === action ? 'open' : action
    const newDecisions = { ...decisions, [clauseKey]: newDecision }
    setDecisions(newDecisions)
    try {
      await saveDecision(clauseKey, clauseName, newDecision)
      const hasCountering = Object.values(newDecisions).some(d => d === 'countering')
      const autoStage = hasCountering ? 'counter_prepared' : 'reviewing'
      if (['reviewing', 'counter_prepared'].includes(lifecycle)) {
        await updateLifecycle(autoStage)
      }
    } catch (e) {
      console.error('Failed to save decision:', e)
    }
  }

  // Decide and advance focus to next undecided clause
  const decideAndAdvance = (clauseKey, action, clauseName) => {
    toggleDecision(clauseKey, action, clauseName)
    if (action !== 'open') {
      const idx = allClauses.findIndex(c => c.clauseKey === clauseKey)
      const next = allClauses.slice(idx + 1).find(c =>
        !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open'
      )
      if (next) setTimeout(() => setActiveId(next.clauseKey), 240)
    }
  }

  const handleCounterEdit = (clauseKey, text) =>
    setCounterEdits(prev => ({ ...prev, [clauseKey]: text }))

  const handleReset = (clauseKey, suggested) => {
    setCounterEdits(prev => ({ ...prev, [clauseKey]: suggested }))
    setResetKeys(prev => ({ ...prev, [clauseKey]: (prev[clauseKey] || 0) + 1 }))
  }

  // Select a pre-parsed option (radio button) — loads its text into the editable box
  const handleOptionSelect = (clauseKey, optionText, optionIdx) => {
    setSelectedOptions(prev => ({ ...prev, [clauseKey]: optionIdx }))
    setCounterEdits(prev => ({ ...prev, [clauseKey]: optionText }))
    setResetKeys(prev => ({ ...prev, [clauseKey]: (prev[clauseKey] || 0) + 1 }))
  }

  // Derived counts
  const openClauses      = allClauses.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')
  const counteringClauses = allClauses.filter(c => decisions[c.clauseKey] === 'countering')
  const agreedClauses    = allClauses.filter(c => decisions[c.clauseKey] === 'accepted')
  const decided          = counteringClauses.length + agreedClauses.length

  const activeIdx = allClauses.findIndex(c => c.clauseKey === activeId)
  const active    = allClauses[activeIdx]

  // Build copyable plain-text summary
  const buildSummary = () => {
    const prop = ws?.name || 'the property'
    const tenant = ws?.client_name ? ` (${ws.client_name})` : ''
    const lines = [`Lease review — ${prop}${tenant}`, '']
    lines.push('AGREED')
    if (agreedClauses.length) agreedClauses.forEach(c => lines.push(`• ${c.location || c.name} — ${c.name}.`))
    else lines.push('• None yet.')
    lines.push('')
    lines.push('NOT AGREED — PROPOSED CHANGES')
    if (counteringClauses.length) {
      counteringClauses.forEach(c => {
        lines.push(`• ${c.location || c.name} — ${c.name}.`)
        const ct = getCounterText(c)
        if (ct) lines.push(`  Proposed: ${ct}`)
        lines.push('')
      })
    } else {
      lines.push('• None yet.')
    }
    return lines.join('\n').trim()
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(buildSummary()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!allClauses.length) {
    return (
      <div className={styles.panel} style={{ marginTop: 24 }}>
        <div className={styles.panelHead}><h2>Clauses</h2></div>
        <div className={styles.empty}>No report yet — analyse a document to see clauses here.</div>
      </div>
    )
  }

  // ── Sub-tab + progress bar ──────────────────────────────────────────
  const pct = allClauses.length ? (decided / allClauses.length) * 100 : 0

  const TabBar = () => (
    <div className={styles.rvTabWrap}>
      <div className={styles.rvTabs}>
        <button
          className={`${styles.rvTab} ${subTab === 'clauses' ? styles.rvTabActive : ''}`}
          onClick={() => setSubTab('clauses')}>
          <span className={styles.rvTabIcon}><PencilIcon /></span>
          Clauses
          {openClauses.length > 0 && <span className={styles.rvTabBadge}>{openClauses.length}</span>}
        </button>
        <button
          className={`${styles.rvTab} ${styles.rvTabSummary} ${subTab === 'summary' ? styles.rvTabActive : ''}`}
          onClick={() => setSubTab('summary')}>
          <span className={styles.rvTabIcon}><CheckIcon s={12} /></span>
          Summary
          <span className={styles.rvTabBadge}>{decided}</span>
        </button>
      </div>
      <div className={styles.rvProg}>
        <div className={styles.rvProgBar}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.rvProgLbl}><b>{decided}</b> of {allClauses.length} reviewed</span>
      </div>
    </div>
  )

  // ── Queue (left column) ─────────────────────────────────────────────
  const Queue = () => (
    <div className={styles.queue}>
      <div className={styles.queueHead}>
        <span>Clauses</span>
        <span className={styles.queueN}>{openClauses.length} to decide</span>
      </div>
      <div className={styles.qList}>
        {allClauses.map(c => {
          const dec = decisions[c.clauseKey] || 'open'
          const isActive = c.clauseKey === activeId
          return (
            <div
              key={c.clauseKey}
              className={`${styles.qItem} ${isActive ? styles.qItemActive : ''}`}
              onClick={() => setActiveId(c.clauseKey)}>
              <span className={styles.qPrio} style={{ background: PRIO_COLOR[c.danger] }} />
              <div className={styles.qtt}>
                {c.location && <div className={styles.qRef}>{c.location}</div>}
                <div className={styles.qNm}>{c.name}</div>
              </div>
              <span className={`${styles.qState} ${
                dec === 'accepted'   ? styles.qStateAgreed :
                dec === 'countering' ? styles.qStateCounter :
                styles.qStateOpen
              }`}>
                {dec === 'accepted'   && <CheckIcon s={10} />}
                {dec === 'countering' && <CounterIcon s={10} />}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Focus card (right column) ───────────────────────────────────────
  const FocusCard = ({ c, idx }) => {
    const dec         = decisions[c.clauseKey] || 'open'
    const counterText = getCounterText(c)
    const edited      = isEdited(c)

    const decBadgeClass =
      dec === 'accepted'   ? styles.sAgreed :
      dec === 'countering' ? styles.sCounter :
      styles.sOpen

    return (
      <div className={styles.focusCard}>
        <div className={styles.fcTop}>
          <div className={styles.fcTagrow}>
            {c.location && <span className={styles.fcRef}>{c.location}</span>}
            <span className={`${styles.sbadge} ${decBadgeClass}`}>
              <span className={styles.sdot} />
              {dec === 'accepted' ? 'Agreed' : dec === 'countering' ? 'Countering' : 'To decide'}
            </span>
          </div>
          <div className={styles.fcName}>{c.name}</div>
        </div>

        <div className={styles.fcBody}>
          {c.quote && (
            <div className={styles.fcQuote}>
              <span className={styles.fcQref}>The clause, verbatim</span>
              "{c.quote}"
            </div>
          )}
          {/* Only use 2-col grid when both blocks have content */}
          <div className={styles.fcBlocks}
            style={c.risk && c.legislation ? undefined : { gridTemplateColumns: '1fr' }}>
            {c.risk && (
              <div className={styles.fcBlock}>
                <div className={styles.fcBlockH}>What it means for you</div>
                <p>{c.risk}</p>
              </div>
            )}
            {c.legislation && (
              <div className={styles.fcBlock}>
                <div className={`${styles.fcBlockH} ${styles.fcBlockHWarn}`}>Relevant legislation</div>
                <p>{c.legislation}</p>
              </div>
            )}
          </div>
        </div>

        {dec !== 'accepted' && c.counter && (() => {
          const options = parseOptions(c.counter)
          const selIdx  = selectedOptions[c.clauseKey] ?? 0

          return (
            <div className={styles.fcCounter}>
              <div className={styles.fcCounterHead}>
                <span className={styles.fcCounterLabel}>Suggested counter</span>
                <span className={`${styles.editTag} ${edited ? styles.editTagEdited : styles.editTagSuggested}`}>
                  <span className={styles.editTagDot} />
                  {edited ? 'Edited by you' : 'Suggested wording'}
                </span>
                {edited && (
                  <button className={styles.resetLink}
                    onClick={() => {
                      const base = options ? options[selIdx].text : c.counter
                      handleReset(c.clauseKey, base)
                    }}>
                    <ResetIcon /> Reset
                  </button>
                )}
              </div>

              {/* Radio option picker — only shown when AI gave multiple options */}
              {options && (
                <div className={styles.optionPicker}>
                  {options.map((opt, i) => (
                    <label key={i}
                      className={`${styles.optionLabel} ${selIdx === i ? styles.optionLabelActive : ''}`}>
                      <input
                        type="radio"
                        className={styles.optionRadio}
                        name={`opts-${c.clauseKey}`}
                        checked={selIdx === i}
                        onChange={() => handleOptionSelect(c.clauseKey, opt.text, i)}
                      />
                      <span className={styles.optionLabelText}>{opt.label}</span>
                      <span className={styles.optionPreview}>{opt.text.slice(0, 80)}{opt.text.length > 80 ? '…' : ''}</span>
                    </label>
                  ))}
                </div>
              )}

              <EditableCounter
                clauseKey={c.clauseKey}
                text={options ? (counterEdits[c.clauseKey] ?? options[selIdx].text) : counterText}
                resetKey={resetKeys[c.clauseKey] || 0}
                onChange={(v) => handleCounterEdit(c.clauseKey, v)}
              />
              <div className={styles.counterHint}>
                <PencilIcon /> Click the text above to edit — your wording is what gets sent.
              </div>
            </div>
          )
        })()}

        <div className={styles.fcActions}>
          <button
            className={`${styles.actBtn} ${styles.actBtnCounter} ${dec === 'countering' ? styles.actBtnCounterOn : ''}`}
            onClick={() => decideAndAdvance(c.clauseKey, 'countering', c.name)}>
            <CounterIcon s={14} /> Counter with this
          </button>
          <button
            className={`${styles.actBtn} ${styles.actBtnAgree} ${dec === 'accepted' ? styles.actBtnAgreeOn : ''}`}
            onClick={() => decideAndAdvance(c.clauseKey, 'accepted', c.name)}>
            <CheckIcon s={14} /> Agree to clause
          </button>
          <span className={`${styles.actNote} ${
            dec === 'accepted'   ? styles.actNoteAgreed :
            dec === 'countering' ? styles.actNoteCounter : ''
          }`}>
            {dec === 'accepted'   ? "You'll accept this clause as drafted"
             : dec === 'countering' ? 'Added to your brief'
             : 'Choose how to respond'}
          </span>
        </div>

        <div className={styles.fcNav}>
          <button className={styles.navBtn} disabled={idx === 0}
            onClick={() => setActiveId(allClauses[idx - 1].clauseKey)}>
            <ChevLeft /> Previous
          </button>
          <span className={styles.fcNavPos}>Clause {idx + 1} of {allClauses.length}</span>
          <button className={`${styles.navBtn} ${styles.navBtnNext}`}
            disabled={idx === allClauses.length - 1}
            onClick={() => setActiveId(allClauses[idx + 1].clauseKey)}>
            Next clause <ChevRight />
          </button>
        </div>
      </div>
    )
  }

  // ── Summary tab ─────────────────────────────────────────────────────
  const SummaryTab = () => (
    <div className={styles.summaryWrap}>
      <div className={styles.summaryMain}>

        <div className={styles.brief}>
          <div className={styles.briefHead}>
            <div className={styles.briefKicker}>Response brief</div>
            <h2 className={styles.briefTitle}>
              Negotiation response — {ws?.name || 'Workspace'}
            </h2>
            {ws?.client_name && <div className={styles.briefMeta}>{ws.client_name}</div>}
          </div>

          {openClauses.length > 0 && (
            <div className={styles.toDecideNote}>
              <span className={styles.toDecideIc}>{openClauses.length}</span>
              <span className={styles.toDecideTx}>
                <b>{openClauses.length} clause{openClauses.length !== 1 ? 's' : ''}</b> still need{openClauses.length === 1 ? 's' : ''} a decision before this brief is complete.
              </span>
              <button className={styles.toDecideGo} onClick={() => setSubTab('clauses')}>
                Back to review →
              </button>
            </div>
          )}

          <div className={styles.briefSec}>
            <div className={styles.briefSecHead}>
              <span className={styles.briefSecTitle}>Clauses we're countering</span>
              <span className={styles.briefSecCt}>· {counteringClauses.length}</span>
            </div>
            {counteringClauses.length ? (
              <>
                <p className={styles.briefSintro}>The wording below is what LeaseLens will package up for the agent. Each entry is either the AI suggestion or your edited version.</p>
                {counteringClauses.map((c, i) => {
                  const edited = isEdited(c)
                  return (
                    <div key={c.clauseKey} className={styles.counterItem}>
                      <div className={styles.ciNum}>{i + 1}.</div>
                      <div className={styles.ciBody}>
                        <div className={styles.ciTop}>
                          {c.location && <span className={styles.ciRef}>{c.location}</span>}
                          <span className={styles.ciName}>{c.name}</span>
                          <button className={styles.ciEdit}
                            onClick={() => { setSubTab('clauses'); setActiveId(c.clauseKey) }}>
                            Edit →
                          </button>
                        </div>
                        <div className={styles.ciText}>"{getCounterText(c)}"</div>
                        <span className={`${styles.editTag} ${styles.ciTag} ${edited ? styles.editTagEdited : styles.editTagSuggested}`}>
                          <span className={styles.editTagDot} />
                          {edited ? 'Your wording' : 'LeaseLens suggested wording'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className={styles.briefEmpty}>Nothing to counter yet — counter a clause in Review and it lands here.</div>
            )}
          </div>

          <div className={styles.briefSec}>
            <div className={styles.briefSecHead}>
              <span className={styles.briefSecTitle}>Accepted as drafted</span>
              <span className={styles.briefSecCt}>· {agreedClauses.length}</span>
            </div>
            {agreedClauses.length ? (
              <div className={styles.agreedList}>
                {agreedClauses.map(c => (
                  <div key={c.clauseKey} className={styles.agreedRow}>
                    <span className={styles.agreedTick}><CheckIcon s={12} /></span>
                    <div className={styles.agreedBody}>
                      {c.location && <div className={styles.agreedRef}>{c.location}</div>}
                      <div className={styles.agreedName}>{c.name}</div>
                    </div>
                    <span className={styles.agreedState}>Accepted</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.briefEmpty}>No clauses accepted yet.</div>
            )}
          </div>
        </div>

        <div className={styles.copyCard}>
          <div className={styles.ccHead}>
            <div>
              <div className={styles.ccTitle}>Response summary</div>
              <div className={styles.ccSub}>Plain text, ready to paste into an email</div>
            </div>
            <button className={`${styles.ccCopy} ${copied ? styles.ccCopyDone : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className={styles.ccPre}>{buildSummary()}</pre>
        </div>
      </div>

      <div className={styles.summarySide}>
        <div className={styles.sendCard}>
          <h3 className={styles.sendCardTitle}>Ready to send</h3>
          <p className={styles.sendCardP}>
            {openClauses.length
              ? `Decide the last ${openClauses.length} clause${openClauses.length !== 1 ? 's' : ''} to finish your brief.`
              : 'Every flagged clause has a decision. Send the brief to the landlord\'s agent or export it for your records.'}
          </p>
          <div className={styles.sendCounts}>
            <div className={styles.sendCount}>
              <div className={`${styles.sendN} ${styles.sendNCnt}`}>{counteringClauses.length}</div>
              <div className={styles.sendL}>Countering</div>
            </div>
            <div className={styles.sendCount}>
              <div className={`${styles.sendN} ${styles.sendNAgr}`}>{agreedClauses.length}</div>
              <div className={styles.sendL}>Agreed</div>
            </div>
            <div className={styles.sendCount}>
              <div className={styles.sendN}>{openClauses.length}</div>
              <div className={styles.sendL}>To decide</div>
            </div>
          </div>
          <button className={styles.sendExport} onClick={handleCopy}>
            {copied ? '✓ Copied to clipboard' : 'Copy email to clipboard'}
          </button>
        </div>
        <p className={styles.disclaimer}>LeaseLens provides informational analysis and does not constitute legal advice.</p>
      </div>
    </div>
  )

  return (
    <>
      {TabBar()}

      {subTab === 'clauses' ? (
        <div className={styles.reviewGrid}>
          {Queue()}
          {active
            ? FocusCard({ c: active, idx: activeIdx })
            : <div className={styles.focusCard} style={{ padding: 32, color: 'var(--muted)' }}>Select a clause from the list.</div>
          }
        </div>
      ) : (
        SummaryTab()
      )}
    </>
  )
}
