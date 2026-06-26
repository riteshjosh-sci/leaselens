import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CompareTab.module.css'

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

  const normaliseName = n => n.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const keyWords = n => normaliseName(n).split(' ').filter(w => w.length > 3).sort().join(' ')

  const findMatch = (name, mapA) => {
    const normB = normaliseName(name), keyB = keyWords(name)
    for (const k of Object.keys(mapA)) if (normaliseName(k) === normB) return k
    let best = null, bestScore = 0
    for (const k of Object.keys(mapA)) {
      const wA = keyWords(k).split(' '), wB = keyB.split(' ')
      const score = wA.filter(w => wB.includes(w)).length / Math.max(wA.length, wB.length)
      if (score > bestScore && score >= 0.5) { bestScore = score; best = k }
    }
    return best
  }

  const buildComparison = (origDoc, revDoc) => {
    const reportA = origDoc?.reports?.[0]?.report_json
    const reportB = revDoc?.reports?.[0]?.report_json
    if (!reportA || !reportB) return null

    const clauseMapA = {}
    ;(reportA.clauses || []).forEach(c => { clauseMapA[c.name] = c })

    const rows = []
    ;(reportB.clauses || []).forEach(clauseB => {
      const matchKey = findMatch(clauseB.name, clauseMapA)
      const clauseA  = matchKey ? clauseMapA[matchKey] : null
      let change = 'same'
      if (!clauseA) {
        // Brand-new clause — classify by its own risk, not a blanket "improved".
        // A new HIGH/MEDIUM-risk clause favours the landlord (risk); only a
        // new LOW-risk clause is genuinely favourable to the tenant.
        change = clauseB.danger === 'LOW' ? 'imp' : 'risk'
      } else {
        const ro = { HIGH: 3, MEDIUM: 2, LOW: 1 }
        const aR = ro[clauseA.danger] || 0, bR = ro[clauseB.danger] || 0
        change = bR < aR ? 'imp' : bR > aR ? 'risk' : 'same'
        delete clauseMapA[matchKey]
      }
      const leftText  = clauseA ? (clauseA.quote || clauseA.risk || '') : ''
      const rightText = clauseB.quote || clauseB.risk || ''
      const textChanged = clauseA ? leftText.trim() !== rightText.trim() : false
      const rightTag = !clauseA ? 'new' : (textChanged ? 'modified' : 'unchanged')
      rows.push({
        change,
        textChanged,
        left:  clauseA ? { nm: clauseA.name, text: leftText, tag: null } : null,
        right: { nm: clauseB.name, text: rightText, tag: rightTag },
        note: clauseB.risk || '',
      })
    })

    Object.values(clauseMapA).forEach(clauseA => {
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
      {comparison && (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryLabel}>Comparison summary</span>
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

      {!hasLeftReport && (
        <div className={styles.noReport}>Previous version (v{leftDoc?.version_number}) has no report yet — run an analysis first.</div>
      )}
      {!hasRightReport && (
        <div className={styles.noReport}>Revised version (v{rightDoc?.version_number}) has no report yet — run an analysis first.</div>
      )}

      {/* 3. CLAUSE COMPARISON — full width */}
      {comparison && (
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
                    <div className={`${styles.ccard} ${styles.ccardEmpty}`}>Not in previous version</div>
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
                          {row.left
                            ? <HighlightedText oldText={row.left.text} newText={row.right.text} />
                            : row.right.text}
                        </p>
                      </div>
                      <span className={styles.sdot} />
                    </div>
                  ) : (
                    <div className={`${styles.ccard} ${styles.ccardEmpty}`}>Removed in revised</div>
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
      {comparison && (comparison.improved.length > 0 || comparison.flagged.length > 0) && (
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
      {comparison && (comparison.improved.length > 0 || comparison.flagged.length > 0) && (
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
