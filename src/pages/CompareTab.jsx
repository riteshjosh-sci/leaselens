import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './NegotiationDetail.module.css'
import cStyles from './CompareTab.module.css'

export default function CompareTab({ negId, docs, navigate: nav }) {
  const navigate = nav || useNavigate()
  const [versionA, setVersionA] = useState(docs.length >= 2 ? docs[docs.length - 2] : null)
  const [versionB, setVersionB] = useState(docs.length >= 1 ? docs[docs.length - 1] : null)
  const [comparison, setComparison] = useState(null)
  const [comparing, setComparing] = useState(false)

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const riskBadge = (risk) => {
    if (!risk) return null
    const map = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }
    return <span className={`${styles.pill} ${map[risk]}`}>{risk}</span>
  }

  const runComparison = () => {
    if (!versionA || !versionB) return
    setComparing(true)

    const reportA = versionA.reports?.[0]?.report_json
    const reportB = versionB.reports?.[0]?.report_json

    if (!reportA || !reportB) { setComparing(false); return }

    const normaliseName = (name) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    const keyWords = (name) => normaliseName(name).split(' ').filter(w => w.length > 3).sort().join(' ')

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

    const clauseMapA = {}
    ;(reportA.clauses || []).forEach(c => { clauseMapA[c.name] = c })

    const results = []
    ;(reportB.clauses || []).forEach(clauseB => {
      const matchKey = findMatch(clauseB.name, clauseMapA)
      const clauseA  = matchKey ? clauseMapA[matchKey] : null
      let status = 'new'
      if (clauseA) {
        const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
        const aRisk = riskOrder[clauseA.danger] || 0
        const bRisk = riskOrder[clauseB.danger] || 0
        status = bRisk < aRisk ? 'improved' : bRisk > aRisk ? 'worsened' : 'unchanged'
        delete clauseMapA[matchKey]
      }
      results.push({ clause: clauseB, prevClause: clauseA, status })
    })

    Object.values(clauseMapA).forEach(clauseA => {
      results.push({ clause: clauseA, prevClause: null, status: 'removed' })
    })

    const order = { worsened: 0, new: 1, unchanged: 2, improved: 3, removed: 4 }
    results.sort((a, b) => order[a.status] - order[b.status])

    const summary = {
      improved:  results.filter(r => r.status === 'improved').length,
      worsened:  results.filter(r => r.status === 'worsened').length,
      unchanged: results.filter(r => r.status === 'unchanged').length,
      new:       results.filter(r => r.status === 'new').length,
      removed:   results.filter(r => r.status === 'removed').length,
    }

    setComparison({ results, summary, reportA, reportB })
    setComparing(false)
  }

  const statusConfig = {
    improved:  { label: 'Improved',   color: 'var(--risk-l)',    bg: 'var(--risk-l-bg)',              border: '#b8d8c4', icon: '↑' },
    worsened:  { label: 'Worsened',   color: 'var(--risk-h)',    bg: 'var(--risk-h-bg)',              border: '#e8c0c0', icon: '↓' },
    unchanged: { label: 'Unchanged',  color: 'var(--ink-light)', bg: 'var(--paper)',                  border: 'var(--rule)', icon: '—' },
    new:       { label: 'New clause', color: 'var(--gold)',      bg: 'var(--gold-light)',             border: '#e0d5c0', icon: '+' },
    removed:   { label: 'Removed',    color: '#60a5fa',          bg: 'rgba(96,165,250,0.08)',         border: '#bfdbfe', icon: '✓' },
  }

  if (docs.length < 2) {
    return (
      <div className={cStyles.empty}>
        <p>You need at least two versions of a document to compare.</p>
        <p style={{ marginTop: 8, fontSize: 13 }}>Upload a new version via "+ Analyse document" to unlock this tab.</p>
      </div>
    )
  }

  return (
    <div className={cStyles.wrap}>
      {/* VERSION SELECTOR */}
      <div className={cStyles.selector}>
        <div className={cStyles.selectorCol}>
          <div className={cStyles.selectorLabel}>Version A (earlier)</div>
          <select className="input" value={versionA?.id || ''} onChange={e => setVersionA(docs.find(v => v.id === e.target.value))}>
            {docs.map(v => (
              <option key={v.id} value={v.id}>v{v.version_number} — {stripTimestamp(v.filename)}</option>
            ))}
          </select>
          {versionA && <div className={cStyles.selectorMeta}>{formatDate(versionA.uploaded_at)} · {riskBadge(versionA.overall_risk)}</div>}
        </div>

        <div className={cStyles.arrow}>→</div>

        <div className={cStyles.selectorCol}>
          <div className={cStyles.selectorLabel}>Version B (later)</div>
          <select className="input" value={versionB?.id || ''} onChange={e => setVersionB(docs.find(v => v.id === e.target.value))}>
            {docs.map(v => (
              <option key={v.id} value={v.id}>v{v.version_number} — {stripTimestamp(v.filename)}</option>
            ))}
          </select>
          {versionB && <div className={cStyles.selectorMeta}>{formatDate(versionB.uploaded_at)} · {riskBadge(versionB.overall_risk)}</div>}
        </div>

        <button className="btn-primary btn-sm" onClick={runComparison}
          disabled={comparing || !versionA || !versionB || versionA?.id === versionB?.id}>
          {comparing ? 'Comparing…' : 'Compare →'}
        </button>
      </div>

      {!versionA?.reports?.[0]?.report_json && versionA && <div className={cStyles.noReport}>Version A has no report yet — run an analysis first.</div>}
      {!versionB?.reports?.[0]?.report_json && versionB && <div className={cStyles.noReport}>Version B has no report yet — run an analysis first.</div>}

      {/* RESULTS */}
      {comparison && (
        <div className={cStyles.results}>
          <div className={cStyles.summaryBanner}>
            <div className={cStyles.bannerTitle}>Changes between v{versionA?.version_number} and v{versionB?.version_number}</div>
            <div className={cStyles.bannerStats}>
              {Object.entries(comparison.summary).map(([key, val]) => {
                const cfg = statusConfig[key]
                return (
                  <div key={key} className={cStyles.bannerStat} style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <span className={cStyles.bannerIcon} style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span className={cStyles.bannerVal}  style={{ color: cfg.color }}>{val}</span>
                    <span className={cStyles.bannerLabel}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
            <div className={cStyles.riskChange}>
              <span>Overall risk:</span>
              {riskBadge(comparison.reportA.overall_risk)}
              <span className={cStyles.riskArrow}>→</span>
              {riskBadge(comparison.reportB.overall_risk)}
            </div>
          </div>

          <div className={cStyles.clauseList}>
            {comparison.results.map((r, i) => {
              const cfg = statusConfig[r.status]
              return (
                <div key={i} className={cStyles.clauseRow} style={{ borderLeft: `3px solid ${cfg.color}` }}>
                  <div className={cStyles.clauseTop}>
                    <div className={cStyles.clauseName}>{r.clause.name}</div>
                    <div className={cStyles.clauseBadges}>
                      {r.prevClause && riskBadge(r.prevClause.danger)}
                      {r.prevClause && <span className={cStyles.clauseArrow}>→</span>}
                      {riskBadge(r.clause.danger)}
                      <span className={cStyles.statusTag} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  </div>
                  {r.status !== 'unchanged' && r.status !== 'removed' && r.clause.risk && (
                    <div className={cStyles.clauseDetail}>
                      <div className={cStyles.detailLabel}>Current risk</div>
                      <p>{r.clause.risk}</p>
                    </div>
                  )}
                  {r.status === 'removed' && (
                    <div className={cStyles.clauseDetail}>
                      <p className={cStyles.removedNote}>This clause was present in version A but does not appear in version B.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
