import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import HelpTip from '../components/HelpTip'
import styles from './CompareTab.module.css'
import { normaliseName, keywordOverlap, extractClauseRef, scorePair } from '../lib/compareMatching'

// Tokenise into words + whitespace/punctuation runs, preserving original string
function tokenise(text) {
  return text.match(/\S+|\s+/g) || []
}

// LCS-based word diff — returns array of { text, added } segments
function diffTokens(oldTokens, newTokens) {
  const m = oldTokens.length, n = newTokens.length
  // Build LCS length table
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldTokens[i-1].toLowerCase() === newTokens[j-1].toLowerCase()
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1])

  // Backtrack
  const ops = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i-1].toLowerCase() === newTokens[j-1].toLowerCase()) {
      ops.push({ text: newTokens[j-1], added: false }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.push({ text: newTokens[j-1], added: true }); j--
    } else {
      i-- // deleted from old — skip in new
    }
  }
  return ops.reverse()
}

// Merge consecutive added tokens into highlight spans
function HighlightedText({ oldText, newText }) {
  if (!oldText || !newText) return <>{newText}</>
  const oldTok = tokenise(oldText)
  const newTok = tokenise(newText)

  // For short texts use full LCS; cap at 300 tokens each to avoid O(n²) on huge blobs
  const ops = diffTokens(
    oldTok.length > 300 ? oldTok.slice(0, 300) : oldTok,
    newTok.length > 300 ? newTok.slice(0, 300) : newTok,
  )

  // Group consecutive added runs
  const nodes = []
  let run = [], key = 0
  const flush = () => {
    if (!run.length) return
    nodes.push(<mark key={key++} className={styles.diffMark}>{run.join('')}</mark>)
    run = []
  }
  for (const op of ops) {
    if (op.added) {
      run.push(op.text)
    } else {
      flush()
      nodes.push(<span key={key++}>{op.text}</span>)
    }
  }
  flush()
  return <>{nodes}</>
}


// ── Structured commercial-terms comparison (uses lease_data, not AI report) ────

const MG_LABELS = { base_building: 'Base building condition', fair_wear_and_tear: 'Fair wear and tear', other: 'Tenant fit-out condition' }
const MG_RANK   = { base_building: 0, other: 1, fair_wear_and_tear: 2 }
const PG_LABELS = { yes: 'Unlimited', limited: 'Limited', no: 'None' }
const PG_RANK   = { yes: 0, limited: 1, no: 2 }
const EX_LABELS = { yes: 'Yes', limited: 'Limited', no: 'None' }

const TERMS_FIELDS = [
  { key: 'base_rent_annual',     label: 'Base Rent',            fmt: v => v != null ? '$' + Number(v).toLocaleString() + ' p.a.' : null,  dir: 'lower_better' },
  { key: 'term_years',           label: 'Lease Term',           fmt: v => v != null ? v + ' years' : null,                                dir: 'higher_better' },
  { key: 'option_terms',         label: 'Options',              fmt: v => v || null,                                                      dir: 'neutral' },
  { key: 'rent_review_rate',     label: 'Rent Review Rate',     fmt: v => v != null ? v + '% p.a.' : null,                               dir: 'lower_better' },
  { key: 'outgoings_annual',     label: 'Outgoings (est.)',     fmt: v => v != null ? '$' + Number(v).toLocaleString() + ' p.a.' : null,  dir: 'lower_better' },
  { key: 'marketing_levy_annual',label: 'Marketing Levy',       fmt: v => v != null ? '$' + Number(v).toLocaleString() + ' p.a.' : null,  dir: 'lower_better' },
  { key: 'bank_guarantee_months',label: 'Bank Guarantee',       fmt: v => v != null ? v + ' months' : null,                              dir: 'lower_better' },
  { key: 'fitout_contribution',  label: 'Fit-Out Contribution', fmt: v => v != null ? '$' + Number(v).toLocaleString() : null,            dir: 'higher_better' },
  { key: 'rent_free_months',     label: 'Rent-Free Period',     fmt: v => v != null ? v + ' months' : null,                              dir: 'higher_better' },
  { key: 'make_good',            label: 'Make Good',            fmt: v => MG_LABELS[v] || v || null,                                     dir: 'make_good' },
  { key: 'personal_guarantee',   label: 'Personal Guarantee',   fmt: v => PG_LABELS[v] || v || null,                                     dir: 'personal_guarantee' },
  { key: 'permitted_use',        label: 'Permitted Use',        fmt: v => v || null,                                                     dir: 'neutral' },
  { key: 'exclusivity',          label: 'Exclusivity',          fmt: v => EX_LABELS[v] || v || null,                                     dir: 'neutral' },
]

function getTermDir(field, vA, vB) {
  if (vA == null && vB == null) return 'same'
  if (String(vA) === String(vB)) return 'same'
  if (vA == null) return field.dir === 'higher_better' ? 'imp' : field.dir === 'lower_better' ? 'risk' : 'mod'
  if (vB == null) return field.dir === 'higher_better' ? 'risk' : field.dir === 'lower_better' ? 'imp' : 'mod'
  if (field.dir === 'lower_better')        return vB < vA ? 'imp' : vB > vA ? 'risk' : 'same'
  if (field.dir === 'higher_better')       return vB > vA ? 'imp' : vB < vA ? 'risk' : 'same'
  if (field.dir === 'make_good')          { const rA = MG_RANK[vA] ?? 1, rB = MG_RANK[vB] ?? 1; return rB > rA ? 'imp' : rB < rA ? 'risk' : 'same' }
  if (field.dir === 'personal_guarantee') { const rA = PG_RANK[vA] ?? 0, rB = PG_RANK[vB] ?? 0; return rB > rA ? 'imp' : rB < rA ? 'risk' : 'same' }
  return 'mod'
}

export default function CompareTab({ negId, docs }) {
  const navigate = useNavigate()
  const sortedDocs = [...docs].sort((a, b) => a.version_number - b.version_number)

  const [leftIdx,  setLeftIdx]  = useState(Math.max(0, sortedDocs.length - 2))
  const [rightIdx, setRightIdx] = useState(sortedDocs.length - 1)
  const [picker,   setPicker]   = useState(null) // 'left' | 'right' | null
  const [comparison, setComparison] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // 'added'|'modified'|'removed'|null

  const leftDoc  = sortedDocs[leftIdx]
  const rightDoc = sortedDocs[rightIdx]

  const ldA = leftDoc?.lease_data?.[0]
  const ldB = rightDoc?.lease_data?.[0]

  const pickerRef = useRef(null)

  useEffect(() => {
    if (!picker) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPicker(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [picker])

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const fileExt = f => f?.split('.').pop()?.toUpperCase() || 'DOC'


  const buildComparison = (origDoc, revDoc) => {
    const reportA = origDoc?.reports?.[0]?.report_json
    const reportB = revDoc?.reports?.[0]?.report_json
    if (!reportA || !reportB) return null

    const clausesA = reportA.clauses || []
    const clausesB = reportB.clauses || []

    const typeCountA = {}, typeCountB = {}
    clausesA.forEach(c => { if (c.clause_type) typeCountA[c.clause_type] = (typeCountA[c.clause_type] || 0) + 1 })
    clausesB.forEach(c => { if (c.clause_type) typeCountB[c.clause_type] = (typeCountB[c.clause_type] || 0) + 1 })

    // Score all A×B pairs; sort by score descending; assign greedily from strongest match.
    // Global approach avoids cascade failures caused by greedy per-clause ordering.
    const candidates = []
    clausesA.forEach((cA, iA) => {
      clausesB.forEach((cB, iB) => {
        const s = scorePair(cA, cB, typeCountA, typeCountB)
        if (s > 0) candidates.push({ iA, iB, s })
      })
    })
    candidates.sort((a, b) => b.s - a.s)

    const assignedA = new Set(), assignedB = new Set()
    const matchMap = {}
    for (const { iA, iB } of candidates) {
      if (assignedA.has(iA) || assignedB.has(iB)) continue
      matchMap[iB] = iA
      assignedA.add(iA)
      assignedB.add(iB)
    }

    const rows = []
    clausesB.forEach((clauseB, iB) => {
      const clauseA = matchMap[iB] !== undefined ? clausesA[matchMap[iB]] : null
      let change = 'same'
      if (!clauseA) {
        change = 'risk'
      } else {
        const ro = { HIGH: 3, MEDIUM: 2, LOW: 1 }
        const aR = ro[clauseA.danger] || 0, bR = ro[clauseB.danger] || 0
        change = bR < aR ? 'imp' : bR > aR ? 'risk' : 'same'
      }
      const leftText  = clauseA ? (clauseA.quote || clauseA.risk || '') : ''
      const rightText = clauseB.quote || clauseB.risk || ''
      const leftRisk  = clauseA ? (clauseA.risk || '') : ''
      const rightRisk = clauseB.risk || ''
      const dangerChanged = clauseA ? clauseA.danger !== clauseB.danger : false
      const textChanged = clauseA ? dangerChanged : false
      const rightTag = !clauseA ? 'new' : (textChanged ? 'modified' : 'unchanged')
      rows.push({
        change,
        textChanged,
        left:  clauseA ? { nm: clauseA.name, text: leftText, riskText: leftRisk, tag: null } : null,
        right: { nm: clauseB.name, text: rightText, riskText: rightRisk, tag: rightTag },
        note: clauseB.risk || '',
      })
    })

    clausesA.forEach((clauseA, iA) => {
      if (assignedA.has(iA)) return
      rows.push({
        change: 'imp',
        textChanged: false,
        left:  { nm: clauseA.name, text: clauseA.risk || clauseA.quote || '', tag: 'removed' },
        right: null,
        note: 'This clause was removed in the revised version.',
      })
    })

    const improved = rows.filter(r => r.change === 'imp' && r.left && r.right).map(r => r.right.nm)
    const flagged  = rows.filter(r => r.change === 'risk').map(r => r.right?.nm || r.left?.nm)
    const summary = {
      added:     rows.filter(r => !r.left && r.right).length,
      modified:  rows.filter(r => r.left && r.right && r.change !== 'same').length,
      removed:   rows.filter(r => r.left && !r.right).length,
      riskClass: rows.some(r => r.change === 'risk') && rows.some(r => r.change === 'imp') ? 'Mixed'
        : rows.some(r => r.change === 'risk') ? 'Up' : 'Down',
      riskLabel: rows.some(r => r.change === 'risk') && rows.some(r => r.change === 'imp') ? 'Mixed'
        : rows.some(r => r.change === 'risk') ? 'Increased' : 'Improved',
    }
    return { rows, summary, improved, flagged }
  }

  useEffect(() => {
    setActiveFilter(null)
    setComparison(buildComparison(leftDoc, rightDoc))
  }, [leftIdx, rightIdx, docs])

  const handlePickVersion = (side, idx) => {
    if (side === 'left') { if (idx !== rightIdx) setLeftIdx(idx) }
    else                 { if (idx !== leftIdx)  setRightIdx(idx) }
    setPicker(null)
  }

  const toggleFilter = (f) => {
    setActiveFilter(prev => prev === f ? null : f)
  }

  const getFilteredRows = (rows) => {
    if (!activeFilter || !rows) return rows
    return rows.filter(r => {
      if (activeFilter === 'added')    return !r.left && r.right
      if (activeFilter === 'removed')  return r.left && !r.right
      if (activeFilter === 'modified') return r.left && r.right && r.change !== 'same'
      return true
    })
  }

  const tintCls = { imp: styles.ccardImp, risk: styles.ccardRsk, same: '', watch: styles.ccardWatch }
  const dotCls  = { imp: styles.dotImp,  risk: styles.dotRsk,  same: styles.dotSame, watch: styles.dotWatch }

  if (docs.length < 2) {
    return (
      <div className={styles.empty}>
        <p>You need at least two document versions to compare.</p>
        <p style={{ marginTop: 6, fontSize: 13 }}>Upload a new version via "+ Add version" to unlock this tab.</p>
      </div>
    )
  }

  const hasLeftReport  = !!leftDoc?.reports?.[0]?.report_json
  const hasRightReport = !!rightDoc?.reports?.[0]?.report_json
  const sameDocument   = !!(leftDoc && rightDoc && (
    (leftDoc.content_hash && rightDoc.content_hash)
      ? leftDoc.content_hash === rightDoc.content_hash
      : stripTimestamp(leftDoc.filename) === stripTimestamp(rightDoc.filename)
  ))

  // ── Version picker dropdown ───────────────────────────────────────
  const VersionPicker = ({ side }) => (
    <div className={styles.pickerDropdown} ref={pickerRef}>
      <div className={styles.pickerHead}>Select version</div>
      {sortedDocs.map((doc, i) => {
        const isOther  = side === 'left' ? i === rightIdx : i === leftIdx
        const isActive = side === 'left' ? i === leftIdx  : i === rightIdx
        return (
          <button key={doc.id}
            className={`${styles.pickerRow} ${isActive ? styles.pickerRowActive : ''} ${isOther ? styles.pickerRowDisabled : ''}`}
            disabled={isOther}
            onClick={() => handlePickVersion(side, i)}>
            <div className={styles.pickerV}>v{doc.version_number}</div>
            <div className={styles.pickerInfo}>
              <div className={styles.pickerFn}>{stripTimestamp(doc.filename)}</div>
              <div className={styles.pickerDate}>{doc.uploaded_at ? formatDate(doc.uploaded_at) : ''}</div>
            </div>
            {isActive
              ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.2l3.2 3.2L13 4.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : !isOther && doc.reports?.[0]?.report_json && <span className={styles.pickerHasReport} />
            }
          </button>
        )
      })}
    </div>
  )

  // ── Doc card ─────────────────────────────────────────────────────
  const DocCard = ({ side, doc, label, labelCls, active }) => (
    <div className={styles.docCardWrap}>
      <button
        className={`${styles.docCard} ${active ? styles.docCardOpen : ''}`}
        onClick={() => setPicker(p => p === side ? null : side)}>
        <div className={styles.dcMain}>
          <span className={`${styles.vtag} ${labelCls}`}>
            <span className={styles.vd} />{label}
          </span>
          <div className={styles.drow}>
            <div className={styles.ficon}>{fileExt(doc?.filename)}</div>
            <div className={styles.dinfo}>
              <div className={styles.fn}>{stripTimestamp(doc?.filename)}</div>
              <div className={styles.fmeta}>v{doc?.version_number} · {doc?.uploaded_at ? formatDate(doc.uploaded_at) : ''}</div>
            </div>
            <svg className={styles.dcChev} width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </button>
      {active && picker === side && <VersionPicker side={side} />}
    </div>
  )

  return (
    <div className={styles.wrap}>

      {/* 1. COMPARISON SUMMARY — at the very top, filterable */}
      {comparison && !sameDocument && (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryLabel}>Comparison summary</span>
          <HelpTip>Each changed clause is colored by who it favours: green when the change benefits you as tenant, rose when it favours the landlord, grey when it's neutral or unchanged.</HelpTip>
          <div className={styles.summaryStats}>
            {[
              { key: 'added',    icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, cls: styles.sumIcoAdd, label: 'Added',    val: comparison.summary.added },
              { key: 'removed',  icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, cls: styles.sumIcoRem, label: 'Removed',  val: comparison.summary.removed },
              { key: 'modified', icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5L5 13.5 2 14l.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>, cls: styles.sumIcoMod, label: 'Modified', val: comparison.summary.modified },
            ].map(r => (
              <button
                key={r.key}
                className={`${styles.statPill} ${activeFilter === r.key ? styles.statPillActive : ''}`}
                onClick={() => toggleFilter(r.key)}
                title={`Filter by ${r.label.toLowerCase()}`}>
                <span className={`${styles.statIco} ${r.cls}`}>{r.icon}</span>
                <span className={styles.statN}>{r.val}</span>
                <span className={styles.statL}>{r.label}</span>
              </button>
            ))}
          </div>
          {activeFilter && (
            <button className={styles.clearFilter} onClick={() => setActiveFilter(null)}>
              Clear filter ✕
            </button>
          )}
          <div className={styles.legend}>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendGood}`} />Tenant favourable</span>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendBad}`} />Landlord favourable</span>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendSame}`} />Neutral</span>
          </div>
        </div>
      )}

      {/* 2. DOC SELECTOR — sits directly above clause columns */}
      <div className={styles.docSelect}>
        <DocCard side="left"  doc={leftDoc}  label="Previous version" labelCls={styles.vtagOrig} active={picker === 'left'} />
        <div className={styles.vsBadge}>VS</div>
        <DocCard side="right" doc={rightDoc} label="Revised version"  labelCls={styles.vtagRev}  active={picker === 'right'} />
      </div>

      {/* 3. COMMERCIAL TERMS — deterministic field-by-field comparison from lease_data */}
      {(ldA || ldB) && (
        <div className={styles.termsSection}>
          <div className={styles.termsSectionHead}>Commercial terms</div>
          <table className={styles.termsTable}>
            <thead>
              <tr>
                <th className={styles.thLabel}>Term</th>
                <th className={styles.thVal}>v{leftDoc?.version_number} — Previous</th>
                <th className={styles.thVal}>v{rightDoc?.version_number} — Revised</th>
                <th className={styles.thDir}>Change</th>
              </tr>
            </thead>
            <tbody>
              {TERMS_FIELDS.map(f => {
                const vA  = ldA?.[f.key] ?? null
                const vB  = ldB?.[f.key] ?? null
                const dir = getTermDir(f, vA, vB)
                const fA  = f.fmt(vA)
                const fB  = f.fmt(vB)
                if (!fA && !fB) return null
                return (
                  <tr key={f.key} className={
                    dir === 'imp'  ? styles.trmRowImp  :
                    dir === 'risk' ? styles.trmRowRisk :
                    dir === 'mod'  ? styles.trmRowMod  :
                    styles.trmRowSame
                  }>
                    <td className={styles.trmLabel}>{f.label}</td>
                    <td className={styles.trmVal}>{fA ?? <span className={styles.trmNil}>—</span>}</td>
                    <td className={styles.trmVal}>{fB ?? <span className={styles.trmNil}>—</span>}</td>
                    <td className={styles.trmDirCell}>
                      {dir === 'imp'  && <span className={styles.trmDirImp}>Improved</span>}
                      {dir === 'risk' && <span className={styles.trmDirRisk}>Higher risk</span>}
                      {dir === 'mod'  && <span className={styles.trmDirMod}>Modified</span>}
                      {dir === 'same' && <span className={styles.trmDirSame}>Unchanged</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!hasLeftReport && (
        <div className={styles.noReport}>Previous version (v{leftDoc?.version_number}) has no report yet — run an analysis first.</div>
      )}
      {!hasRightReport && (
        <div className={styles.noReport}>Revised version (v{rightDoc?.version_number}) has no report yet — run an analysis first.</div>
      )}
      {sameDocument && (
        <div className={styles.noReport}>Same document selected — upload a revised version to compare changes.</div>
      )}

      {/* 4. CLAUSE COMPARISON — full width */}
      {comparison && !sameDocument && (
        <div className={styles.comparePanel}>
          <div className={styles.compareHead}>
            <div className={styles.chSide}>
              <span className={styles.chT}>v{leftDoc?.version_number} — Previous</span>
              <span className={styles.chCt}>{leftDoc?.reports?.[0]?.report_json?.clauses?.length || 0} clauses</span>
            </div>
            <div className={styles.chSide}>
              <span className={styles.chT}>v{rightDoc?.version_number} — Revised</span>
              <span className={styles.chCt}>{rightDoc?.reports?.[0]?.report_json?.clauses?.length || 0} clauses</span>
            </div>
            <div className={styles.chNote}>What changed</div>
          </div>

          <div className={styles.crows}>
            {getFilteredRows(comparison.rows).map((row, i) => {
              return (
                <div key={i} className={styles.crow}>
                  {row.left ? (
                    <div className={`${styles.ccard} ${dotCls[row.change]}`}>
                      <div className={styles.no}>{i + 1}</div>
                      <div className={styles.ccTt}>
                        <div className={styles.nm}>
                          {row.left.nm}
                          {row.left.tag === 'removed' && <span className={styles.tagRm}>Removed</span>}
                        </div>
                        <p>{row.left.text}</p>
                      </div>
                      <span className={styles.sdot} />
                    </div>
                  ) : (
                    <div className={`${styles.ccard} ${styles.ccardEmpty}`}>Not in previous analysis</div>
                  )}

                  {row.right ? (
                    <div className={`${styles.ccard} ${tintCls[row.change]}`}>
                      <div className={styles.no}>{i + 1}</div>
                      <div className={styles.ccTt}>
                        <div className={styles.nm}>
                          {row.right.nm}
                          {row.right.tag === 'new' && <span className={styles.tagNew}>New</span>}
                          {row.right.tag === 'modified' && <span className={styles.tagModified}>Modified</span>}
                          {row.right.tag === 'unchanged' && <span className={styles.tagUnchanged}>Unchanged</span>}
                        </div>
                        <p>
                          {row.textChanged && row.left
                            ? <HighlightedText oldText={row.left.riskText} newText={row.right.riskText} />
                            : row.right.text}
                        </p>
                      </div>
                      <span className={styles.sdot} />
                    </div>
                  ) : (
                    <div className={`${styles.ccard} ${styles.ccardEmpty}`}>Not in revised analysis</div>
                  )}

                  {row.change === 'same' && !row.textChanged ? (
                    <div className={`${styles.ccNote} ${styles.ccNoteSame}`}>
                      <span className={styles.noteLead}>Unchanged</span>
                    </div>
                  ) : row.note ? (
                    <div className={`${styles.ccNote} ${
                      row.change === 'imp' ? styles.ccNoteImp :
                      row.change === 'risk' ? styles.ccNoteRsk :
                      styles.ccNoteMod
                    }`}>
                      <span className={styles.noteLead}>
                        {row.change === 'imp' ? '✓ What changed' :
                         row.change === 'risk' ? '⚠ What changed' :
                         '~ Modified'}
                      </span>
                      {row.note}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {comparison.rows.length === 0 && (
              <div className={styles.emptyFilter}>No clauses match this filter.</div>
            )}
          </div>
        </div>
      )}

      {/* 4. VERDICT STRIP — no title, just chips + Review clauses button */}
      {comparison && !sameDocument && (comparison.improved.length > 0 || comparison.flagged.length > 0) && (
        <div className={styles.verdictStrip}>
          <div className={styles.verdictLeft}>
            {comparison.improved.length > 0 && (
              <span className={styles.favVerdict}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.6l5 2v3.4c0 3-2.1 5-5 5.4-2.9-.4-5-2.4-5-5.4V3.6l5-2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                Revised — on balance
              </span>
            )}
            <div className={styles.verdictClauses}>
              {comparison.improved.slice(0, 4).map((nm, i) => (
                <span key={`g${i}`} className={styles.verdictChipGood}>
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M3 8.2l3.2 3.2L13 4.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {nm}
                </span>
              ))}
              {comparison.flagged.slice(0, 4).map((nm, i) => (
                <span key={`f${i}`} className={styles.verdictChipFlag}>
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M8 4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="8" cy="12" r="1.1" fill="currentColor"/></svg>
                  {nm}
                </span>
              ))}
            </div>
          </div>
          <button className={styles.favCta} onClick={() => navigate(`/negotiation/${negId}#review`)}>
            Review clauses →
          </button>
        </div>
      )}

      {/* 5. KEY DIFFERENCES */}
      {comparison && !sameDocument && (comparison.improved.length > 0 || comparison.flagged.length > 0) && (
        <div className={styles.keydiff}>
          <div className={styles.kdHead}>
            <h2 className={styles.kdTitle}>Key differences</h2>
            <div className={styles.kdSub}>The changes most worth knowing about.</div>
          </div>
          <div className={styles.kdGrid}>
            {comparison.improved.slice(0, 3).map((nm, i) => (
              <div key={`imp-${i}`} className={`${styles.kdCard} ${styles.kdImp}`}>
                <div className={`${styles.kt} ${styles.ktImp}`}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8.2l3.2 3.2L13 4.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {nm}
                </div>
                <span className={`${styles.kdTag} ${styles.kdTagImp}`}><span className={styles.kdTagD} />Favourable</span>
              </div>
            ))}
            {comparison.flagged.slice(0, 3).map((nm, i) => (
              <div key={`rsk-${i}`} className={`${styles.kdCard} ${styles.kdRsk}`}>
                <div className={`${styles.kt} ${styles.ktRsk}`}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="8" cy="12" r="1.1" fill="currentColor"/></svg>
                  {nm}
                </div>
                <span className={`${styles.kdTag} ${styles.kdTagRsk}`}><span className={styles.kdTagD} />Higher risk</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
