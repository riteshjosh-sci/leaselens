import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CompareTab.module.css'

export default function CompareTab({ negId, docs }) {
  const navigate = useNavigate()
  const [swapped, setSwapped]       = useState(false)
  const [comparison, setComparison] = useState(null)
  const [comparing, setComparing]   = useState(false)
  const [openRow, setOpenRow]       = useState(null)

  const sortedDocs = [...docs].sort((a, b) => a.version_number - b.version_number)
  const origDoc = swapped ? sortedDocs[sortedDocs.length - 1] : sortedDocs[0]
  const revDoc  = swapped ? sortedDocs[0] : sortedDocs[sortedDocs.length - 1]

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const fileExt = f => f?.split('.').pop()?.toUpperCase() || 'DOC'

  const normaliseName = name =>
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const keyWords = name =>
    normaliseName(name).split(' ').filter(w => w.length > 3).sort().join(' ')

  const findMatch = (name, mapA) => {
    const normB = normaliseName(name)
    const keyB  = keyWords(name)
    for (const key of Object.keys(mapA)) {
      if (normaliseName(key) === normB) return key
    }
    let bestMatch = null, bestScore = 0
    for (const key of Object.keys(mapA)) {
      const wordsA = keyWords(key).split(' ')
      const wordsB = keyB.split(' ')
      const common = wordsA.filter(w => wordsB.includes(w)).length
      const score  = common / Math.max(wordsA.length, wordsB.length)
      if (score > bestScore && score >= 0.5) { bestScore = score; bestMatch = key }
    }
    return bestMatch
  }

  const runComparison = () => {
    const reportA = origDoc?.reports?.[0]?.report_json
    const reportB = revDoc?.reports?.[0]?.report_json
    if (!reportA || !reportB) return
    setComparing(true)

    const clauseMapA = {}
    ;(reportA.clauses || []).forEach(c => { clauseMapA[c.name] = c })

    const rows = []
    ;(reportB.clauses || []).forEach(clauseB => {
      const matchKey = findMatch(clauseB.name, clauseMapA)
      const clauseA  = matchKey ? clauseMapA[matchKey] : null
      let change = 'same'
      if (!clauseA) {
        change = 'imp'
      } else {
        const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
        const aRisk = riskOrder[clauseA.danger] || 0
        const bRisk = riskOrder[clauseB.danger] || 0
        if (bRisk < aRisk)      change = 'imp'
        else if (bRisk > aRisk) change = 'risk'
        else                    change = 'same'
        delete clauseMapA[matchKey]
      }

      rows.push({
        change,
        left:  clauseA ? {
          nm:   clauseA.name,
          text: clauseA.risk || clauseA.quote || '',
          tag:  null,
        } : null,
        right: {
          nm:   clauseB.name,
          text: clauseB.risk || clauseB.quote || '',
          tag:  !clauseA ? 'new' : null,
        },
        note: clauseB.risk || '',
      })
    })

    Object.values(clauseMapA).forEach(clauseA => {
      rows.push({
        change: 'imp',
        left:  { nm: clauseA.name, text: clauseA.risk || clauseA.quote || '', tag: 'removed' },
        right: null,
        note:  'This clause was removed in the revised version.',
      })
    })

    const summary = {
      added:    rows.filter(r => !r.left && r.right).length,
      modified: rows.filter(r => r.left && r.right && r.change !== 'same').length,
      removed:  rows.filter(r => r.left && !r.right).length,
      riskClass: rows.some(r => r.change === 'risk') && rows.some(r => r.change === 'imp')
        ? 'Mixed' : rows.some(r => r.change === 'risk') ? 'Up' : 'Down',
      riskLabel: rows.some(r => r.change === 'risk') && rows.some(r => r.change === 'imp')
        ? 'Mixed' : rows.some(r => r.change === 'risk') ? 'Increased' : 'Improved',
    }

    const improved = rows.filter(r => r.change === 'imp' && r.left && r.right).map(r => r.right.nm)
    const flagged  = rows.filter(r => r.change === 'risk').map(r => r.right?.nm || r.left?.nm)

    setComparison({ rows, summary, improved, flagged })
    setComparing(false)
  }

  const connCls = { imp: styles.connImp, risk: styles.connRsk, same: '', watch: styles.connWatch }
  const tintCls = { imp: styles.ccardImp, risk: styles.ccardRsk, same: '', watch: styles.ccardWatch }
  const dotCls  = { imp: styles.dotImp, risk: styles.dotRsk, same: styles.dotSame, watch: styles.dotWatch }

  if (docs.length < 2) {
    return (
      <div className={styles.empty}>
        <p>You need at least two document versions to compare.</p>
        <p style={{ marginTop: 6, fontSize: 13 }}>Upload a new version via "+ Add version" to unlock this tab.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>

      {/* DOCUMENT SELECTOR */}
      <div className={styles.docSelect}>
        <div className={styles.docCard}>
          <div className={styles.dcMain}>
            <span className={`${styles.vtag} ${styles.vtagOrig}`}>
              <span className={styles.vd} />Previous version
            </span>
            <div className={styles.drow}>
              <div className={styles.ficon}>{fileExt(origDoc?.filename)}</div>
              <div className={styles.dinfo}>
                <div className={styles.fn}>{stripTimestamp(origDoc?.filename)}</div>
                <div className={styles.fmeta}>v{origDoc?.version_number} · {origDoc?.uploaded_at ? formatDate(origDoc.uploaded_at) : ''}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.vsBadge}>VS</div>

        <div className={styles.docCard}>
          <div className={styles.dcMain}>
            <span className={`${styles.vtag} ${styles.vtagRev}`}>
              <span className={styles.vd} />Revised version
            </span>
            <div className={styles.drow}>
              <div className={styles.ficon}>{fileExt(revDoc?.filename)}</div>
              <div className={styles.dinfo}>
                <div className={styles.fn}>{stripTimestamp(revDoc?.filename)}</div>
                <div className={styles.fmeta}>v{revDoc?.version_number} · {revDoc?.uploaded_at ? formatDate(revDoc.uploaded_at) : ''}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.docActions}>
          <button className={styles.swapBtn} onClick={() => { setSwapped(s => !s); setComparison(null) }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 5h9M9.5 2.5L12 5 9.5 7.5M13 11H4M6.5 8.5L4 11l2.5 2.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Swap
          </button>
          <button className={styles.compareBtn} onClick={runComparison}
            disabled={comparing || !origDoc?.reports?.[0]?.report_json || !revDoc?.reports?.[0]?.report_json}>
            {comparing ? 'Comparing…' : 'Compare →'}
          </button>
        </div>
      </div>

      {!origDoc?.reports?.[0]?.report_json && (
        <div className={styles.noReport}>Previous version has no report yet — run an analysis first.</div>
      )}
      {!revDoc?.reports?.[0]?.report_json && (
        <div className={styles.noReport}>Revised version has no report yet — run an analysis first.</div>
      )}

      {/* COMPARISON RESULTS */}
      {comparison && (
        <div className={styles.cmpBody}>
          <div className={styles.cmpMain}>

            {/* CLAUSE PANEL */}
            <div className={styles.comparePanel}>
              <div className={styles.compareHead}>
                <div className={styles.chSide}>
                  <span className={styles.chT}>Previous version</span>
                  <span className={styles.chCt}>{origDoc?.reports?.[0]?.report_json?.clauses?.length || 0} clauses</span>
                </div>
                <div className={styles.chMid} />
                <div className={styles.chSide}>
                  <span className={styles.chT}>Revised version</span>
                  <span className={styles.chCt}>{revDoc?.reports?.[0]?.report_json?.clauses?.length || 0} clauses</span>
                </div>
              </div>

              <div className={styles.crows}>
                {comparison.rows.map((row, i) => {
                  const isOpen = openRow === i
                  const left  = swapped ? row.right : row.left
                  const right = swapped ? row.left  : row.right

                  return (
                    <div key={i} className={`${styles.crow} ${isOpen ? styles.crowOpen : ''}`}>
                      {left ? (
                        <div className={`${styles.ccard} ${dotCls[row.change]} ${styles.ccardToggle}`}
                          onClick={() => setOpenRow(isOpen ? null : i)}>
                          <div className={styles.no}>{i + 1}</div>
                          <div className={styles.ccTt}>
                            <div className={styles.nm}>
                              {left.nm}
                              {left.tag === 'removed' && <span className={styles.tagRm}>Removed</span>}
                            </div>
                            <p>{left.text}</p>
                          </div>
                          <span className={styles.sdot} />
                        </div>
                      ) : (
                        <div className={`${styles.ccard} ${styles.ccardEmpty}`}>Not in previous version</div>
                      )}

                      <div className={`${styles.conn} ${connCls[row.change]}`}>
                        <span className={styles.connLine} />
                        <span className={styles.connDot} />
                      </div>

                      {right ? (
                        <div className={`${styles.ccard} ${tintCls[row.change]} ${styles.ccardToggle}`}
                          onClick={() => setOpenRow(isOpen ? null : i)}>
                          <div className={styles.no}>{i + 1}</div>
                          <div className={styles.ccTt}>
                            <div className={styles.nm}>
                              {right.nm}
                              {right.tag === 'new' && <span className={styles.tagNew}>New</span>}
                            </div>
                            <p>{right.text}</p>
                          </div>
                          <span className={styles.sdot} />
                        </div>
                      ) : (
                        <div className={`${styles.ccard} ${styles.ccardEmpty}`}>Removed in revised</div>
                      )}

                      {isOpen && row.note && (
                        <div className={`${styles.ccNote} ${row.change === 'imp' ? styles.ccNoteImp : row.change === 'risk' ? styles.ccNoteRsk : styles.ccNoteSame}`}>
                          <span className={styles.noteLead}>
                            {row.change === 'imp' ? '✓ What changed' : row.change === 'risk' ? '⚠ What changed' : 'Unchanged'}
                          </span>
                          {row.note}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* KEY DIFFERENCES */}
            {(comparison.improved.length > 0 || comparison.flagged.length > 0) && (
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

          {/* RIGHT RAIL */}
          <div className={styles.cmpRail}>
            <div className={styles.railCard}>
              <h3 className={styles.railH}>Comparison summary</h3>
              {[
                { cls: styles.sumIcoAdd, icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, label: 'Added clauses', val: comparison.summary.added },
                { cls: styles.sumIcoMod, icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5L5 13.5 2 14l.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>, label: 'Modified clauses', val: comparison.summary.modified },
                { cls: styles.sumIcoRem, icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, label: 'Removed clauses', val: comparison.summary.removed },
              ].map(r => (
                <div key={r.label} className={styles.sumRow}>
                  <span className={`${styles.sumIco} ${r.cls}`}>{r.icon}</span>
                  <span className={styles.sumSl}>{r.label}</span>
                  <span className={styles.sumN}>{r.val}</span>
                </div>
              ))}
              <div className={styles.sumRow}>
                <span className={`${styles.sumIco} ${styles.sumIcoRk}`}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.6l5 2v3.4c0 3-2.1 5-5 5.4-2.9-.4-5-2.4-5-5.4V3.6l5-2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                </span>
                <span className={styles.sumSl}>Risk change</span>
                <span className={`${styles.schip} ${comparison.summary.riskClass === 'Up' ? styles.schipUp : comparison.summary.riskClass === 'Down' ? styles.schipDown : styles.schipMixed}`}>
                  {comparison.summary.riskLabel}
                </span>
              </div>
            </div>

            <div className={styles.railCard}>
              <h3 className={styles.railH}>Which version is better?</h3>
              {comparison.improved.length > 0 && (
                <>
                  <div className={styles.favVerdict}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.6l5 2v3.4c0 3-2.1 5-5 5.4-2.9-.4-5-2.4-5-5.4V3.6l5-2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                    Revised — on balance
                  </div>
                  <ul className={styles.favList}>
                    {comparison.improved.map((nm, i) => (
                      <li key={i} className={styles.favGood}>
                        <span className={`${styles.favTick} ${styles.favTickGood}`}>
                          <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M3 8.2l3.2 3.2L13 4.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        {nm}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {comparison.flagged.length > 0 && (
                <>
                  <div className={styles.favDivider} />
                  <div className={styles.favFlagH}>Worth countering</div>
                  <ul className={styles.favList}>
                    {comparison.flagged.map((nm, i) => (
                      <li key={i} className={styles.favFlag}>
                        <span className={`${styles.favTick} ${styles.favTickFlag}`}>
                          <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M8 4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="8" cy="12" r="1.1" fill="currentColor"/></svg>
                        </span>
                        {nm}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button className={styles.favCta} onClick={() => navigate(`/negotiation/${negId}#review`)}>
                Review &amp; counter clauses →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
