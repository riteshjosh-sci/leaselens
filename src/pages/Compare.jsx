import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Compare.module.css'

export default function Compare() {
  const { negotiationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [negotiation, setNegotiation] = useState(null)
  const [versions, setVersions] = useState([])
  const [versionA, setVersionA] = useState(null)
  const [versionB, setVersionB] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchVersions()
  }, [negotiationId, user])

  const fetchVersions = async () => {
    const { data: neg } = await supabase
      .from('negotiations')
      .select('id, property_name')
      .eq('id', negotiationId)
      .single()

    const { data: docs } = await supabase
      .from('documents')
      .select('id, filename, version_number, uploaded_at, overall_risk, content_hash, reports(id, report_json)')
      .eq('negotiation_id', negotiationId)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: true })

    setNegotiation(neg)
    setVersions(docs || [])

    if (docs?.length >= 2) {
      setVersionA(docs[0])
      setVersionB(docs[docs.length - 1])
    }

    setLoading(false)
  }

  const runComparison = () => {
    if (!versionA || !versionB) return
    setComparing(true)

    const reportA = versionA.reports?.[0]?.report_json
    const reportB = versionB.reports?.[0]?.report_json

    if (!reportA || !reportB) {
      setComparing(false)
      return
    }

    // Fuzzy clause matching — normalise names before comparing
    const normaliseName = (name) => name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Extract key words from clause name for matching
    const keyWords = (name) => normaliseName(name)
      .split(' ')
      .filter(w => w.length > 3)
      .sort()
      .join(' ')

    // Find best match in clauseMapA for a given clause name
    const findMatch = (name, mapA) => {
      const normB = normaliseName(name)
      const keyB = keyWords(name)

      // Try exact normalised match first
      for (const [key, clause] of Object.entries(mapA)) {
        if (normaliseName(key) === normB) return key
      }

      // Try keyword overlap match
      let bestMatch = null
      let bestScore = 0
      for (const [key, clause] of Object.entries(mapA)) {
        const keyA = keyWords(key)
        const wordsA = keyA.split(' ')
        const wordsB = keyB.split(' ')
        const common = wordsA.filter(w => wordsB.includes(w)).length
        const score = common / Math.max(wordsA.length, wordsB.length)
        if (score > bestScore && score >= 0.5) {
          bestScore = score
          bestMatch = key
        }
      }
      return bestMatch
    }

    // Build clause map from version A
    const clauseMapA = {}
    ;(reportA.clauses || []).forEach(c => { clauseMapA[c.name] = c })

    // Compare each clause in version B against version A
    const results = []

    ;(reportB.clauses || []).forEach(clauseB => {
      const matchKey = findMatch(clauseB.name, clauseMapA)
      const clauseA = matchKey ? clauseMapA[matchKey] : null
      let status = 'new'

      if (clauseA) {
        const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
        const aRisk = riskOrder[clauseA.danger] || 0
        const bRisk = riskOrder[clauseB.danger] || 0
        if (bRisk < aRisk) status = 'improved'
        else if (bRisk > aRisk) status = 'worsened'
        else status = 'unchanged'
        delete clauseMapA[matchKey]
      }

      results.push({ clause: clauseB, prevClause: clauseA, status })
    })

    // Any remaining in A were removed
    Object.values(clauseMapA).forEach(clauseA => {
      results.push({ clause: clauseA, prevClause: null, status: 'removed' })
    })

    // Sort: worsened first, then new, then unchanged, then improved, then removed
    const order = { worsened: 0, new: 1, unchanged: 2, improved: 3, removed: 4 }
    results.sort((a, b) => order[a.status] - order[b.status])

    const summary = {
      improved: results.filter(r => r.status === 'improved').length,
      worsened: results.filter(r => r.status === 'worsened').length,
      unchanged: results.filter(r => r.status === 'unchanged').length,
      new: results.filter(r => r.status === 'new').length,
      removed: results.filter(r => r.status === 'removed').length,
    }

    setComparison({ results, summary, reportA, reportB })
    setComparing(false)
  }

  const statusConfig = {
    improved:  { label: 'Improved',  color: 'var(--risk-l)', bg: 'var(--risk-l-bg)', border: '#b8d8c4', icon: '↑' },
    worsened:  { label: 'Worsened',  color: 'var(--risk-h)', bg: 'var(--risk-h-bg)', border: '#e8c0c0', icon: '↓' },
    unchanged: { label: 'Unchanged', color: 'var(--ink-light)', bg: 'var(--paper)', border: 'var(--rule)', icon: '—' },
    new:       { label: 'New clause', color: 'var(--gold)', bg: 'var(--gold-light)', border: '#e0d5c0', icon: '+' },
    removed:   { label: 'Removed',   color: '#60a5fa', bg: '#eff6ff', border: '#bfdbfe', icon: '✓' },
  }

  const riskBadge = (risk) => {
    if (!risk) return null
    const map = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' }
    return <span className={`badge ${map[risk]}`}>{risk}</span>
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) return (
    <>
      <Nav />
      <div className={styles.loading}>Loading versions...</div>
    </>
  )

  if (versions.length < 2) return (
    <>
      <Nav />
      <div className={styles.errorWrap}>
        <h2>Not enough versions</h2>
        <p>You need at least two versions of this document to compare.</p>
        <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
      </div>
    </>
  )

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <button className={styles.back} onClick={() => navigate('/dashboard')}>← Dashboard</button>

        <div className={styles.kicker}>Version comparison</div>
        <h1 className={styles.h1}>{negotiation?.property_name || 'Document comparison'}</h1>

        {/* VERSION SELECTOR */}
        <div className={styles.selector}>
          <div className={styles.selectorCol}>
            <div className={styles.selectorLabel}>Version A (earlier)</div>
            <select className="input" value={versionA?.id || ''} onChange={e => setVersionA(versions.find(v => v.id === e.target.value))}>
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.version_number} — {v.filename.replace(/^\d+_/, '')}</option>
              ))}
            </select>
            {versionA && <div className={styles.selectorMeta}>{formatDate(versionA.uploaded_at)} · {riskBadge(versionA.overall_risk)}</div>}
          </div>

          <div className={styles.arrow}>→</div>

          <div className={styles.selectorCol}>
            <div className={styles.selectorLabel}>Version B (later)</div>
            <select className="input" value={versionB?.id || ''} onChange={e => setVersionB(versions.find(v => v.id === e.target.value))}>
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.version_number} — {v.filename}</option>
              ))}
            </select>
            {versionB && <div className={styles.selectorMeta}>{formatDate(versionB.uploaded_at)} · {riskBadge(versionB.overall_risk)}</div>}
          </div>

          <button className="btn-primary" onClick={runComparison} disabled={comparing || !versionA || !versionB || versionA?.id === versionB?.id}>
            {comparing ? 'Comparing...' : 'Compare →'}
          </button>
        </div>

        {!versionA?.reports?.[0]?.report_json && versionA && (
          <div className={styles.noReport}>Version A has no report yet — run an analysis first.</div>
        )}
        {!versionB?.reports?.[0]?.report_json && versionB && (
          <div className={styles.noReport}>Version B has no report yet — run an analysis first.</div>
        )}

        {/* COMPARISON RESULTS */}
        {comparison && (
          <div className={styles.results}>
            {/* Summary banner */}
            <div className={styles.summaryBanner}>
              <div className={styles.bannerTitle}>What changed between v{versionA?.version_number} and v{versionB?.version_number}</div>
              <div className={styles.bannerStats}>
                {Object.entries(comparison.summary).map(([key, val]) => {
                  const cfg = statusConfig[key]
                  return (
                    <div key={key} className={styles.bannerStat} style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <span className={styles.bannerIcon} style={{ color: cfg.color }}>{cfg.icon}</span>
                      <span className={styles.bannerVal} style={{ color: cfg.color }}>{val}</span>
                      <span className={styles.bannerLabel}>{cfg.label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Overall risk change */}
              <div className={styles.riskChange}>
                <span>Overall risk:</span>
                {riskBadge(comparison.reportA.overall_risk)}
                <span className={styles.riskArrow}>→</span>
                {riskBadge(comparison.reportB.overall_risk)}
                {comparison.reportA.overall_risk !== comparison.reportB.overall_risk && (
                  <span className={styles.riskChangeLabel} style={{
                    color: comparison.reportB.overall_risk === 'HIGH' ? 'var(--risk-h)'
                      : comparison.reportB.overall_risk === 'LOW' ? 'var(--risk-l)'
                      : 'var(--gold)'
                  }}>
                    {['HIGH','MEDIUM','LOW'].indexOf(comparison.reportB.overall_risk) >
                     ['HIGH','MEDIUM','LOW'].indexOf(comparison.reportA.overall_risk)
                      ? '↑ Improved' : '↓ Worsened'}
                  </span>
                )}
              </div>
            </div>

            {/* Clause list */}
            <div className={styles.clauseList}>
              {comparison.results.map((r, i) => {
                const cfg = statusConfig[r.status]
                return (
                  <div key={i} className={styles.clauseRow} style={{ borderLeft: `3px solid ${cfg.color}` }}>
                    <div className={styles.clauseTop}>
                      <div className={styles.clauseName}>{r.clause.name}</div>
                      <div className={styles.clauseBadges}>
                        {r.prevClause && riskBadge(r.prevClause.danger)}
                        {r.prevClause && <span className={styles.clauseArrow}>→</span>}
                        {riskBadge(r.clause.danger)}
                        <span className={styles.statusTag} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                    </div>

                    {r.status !== 'unchanged' && r.status !== 'removed' && (
                      <div className={styles.clauseDetail}>
                        {r.clause.risk && (
                          <div className={styles.detailSection}>
                            <div className={styles.detailLabel}>Current risk</div>
                            <p>{r.clause.risk}</p>
                          </div>
                        )}
                        {r.clause.counter && (
                          <div className={styles.counterBox}>
                            <div className={styles.detailLabel}>Suggested response</div>
                            <p>{r.clause.counter}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {r.status === 'removed' && (
                      <div className={styles.clauseDetail}>
                        <p className={styles.removedNote}>This clause was present in version A but does not appear in version B.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}