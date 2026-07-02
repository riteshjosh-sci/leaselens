import { useEffect, useRef } from 'react'
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

export default function ReviewTab({
  allClauses, decisions, activeId, setActiveId, decideAndAdvance,
  getCounterText, isEdited, counterEdits, resetKeys, selectedOptions,
  handleCounterEdit, handleReset, handleOptionSelect, decided, onViewSummary,
}) {
  if (!allClauses.length) {
    return (
      <div className={styles.panel} style={{ marginTop: 24 }}>
        <div className={styles.panelHead}><h2>Clauses</h2></div>
        <div className={styles.empty}>No report yet — analyse a document to see clauses here.</div>
      </div>
    )
  }

  const openClauses = allClauses.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')
  const pct = allClauses.length ? (decided / allClauses.length) * 100 : 0
  const activeIdx = allClauses.findIndex(c => c.clauseKey === activeId)
  const active    = allClauses[activeIdx]

  // ── Progress bar ─────────────────────────────────────────────────────
  const Progress = () => (
    <div className={styles.rvTabWrap}>
      <div className={styles.rvProg}>
        <div className={styles.rvProgBar}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.rvProgLbl}><b>{decided}</b> of {allClauses.length} reviewed</span>
      </div>
      <button
        className="btn-primary"
        disabled={decided === 0}
        onClick={onViewSummary}
      >
        View summary <ChevRight />
      </button>
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
            <div className={`${styles.fcCounter} ${c.danger === 'LOW' ? styles.fcCounterFav : ''}`}>
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
          {idx === allClauses.length - 1 && decided === allClauses.length
            ? <button className={`${styles.navBtn} ${styles.navBtnNext} ${styles.navBtnSummary}`}
                onClick={onViewSummary}>
                View summary <ChevRight />
              </button>
            : <button className={`${styles.navBtn} ${styles.navBtnNext}`}
                disabled={idx === allClauses.length - 1}
                onClick={() => setActiveId(allClauses[idx + 1].clauseKey)}>
                Next clause <ChevRight />
              </button>
          }
        </div>
      </div>
    )
  }

  return (
    <>
      {Progress()}
      <div className={styles.reviewGrid}>
        {Queue()}
        {active
          ? FocusCard({ c: active, idx: activeIdx })
          : <div className={styles.focusCard} style={{ padding: 32, color: 'var(--muted)' }}>Select a clause from the list.</div>
        }
      </div>
      <div className={styles.reviewFooter}>
        {decided === 0 && (
          <span className={styles.reviewFooterHint}>Agree or counter a clause to continue</span>
        )}
        <button
          className="btn-primary"
          disabled={decided === 0}
          onClick={onViewSummary}
        >
          View summary <ChevRight />
        </button>
      </div>
    </>
  )
}
