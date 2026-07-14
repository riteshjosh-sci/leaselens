import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import HelpTip from '../components/HelpTip'
import styles from './CompareTab.module.css'
import { supabase } from '../lib/supabase'

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

// ── Summary text parsing (HOA docs where lease_data is absent) ───────────────
const SUMMARY_PATS = [
  // Base rent: labelled form, dollar-first form, or bare "at/of $X p.a." fallback
  // All alternatives handle "per annum" in full as well as "p.a." / "pa"
  { label: 'Base rent',           pat: /(?:base|commencing)\s+rent\s+(?:of\s+)?((?:\$|AUD\s*)[\d,]+(?:\.\d+)?)\s*p(?:er\s+annum|\.?a\.?|er\s+year)|(\$[\d,]+(?:\.\d+)?)\s+(?:base|commencing)\s+rent\b|(?:at|of)\s+((?:\$|AUD\s*)[\d,]+(?:\.\d+)?)\s+p(?:er\s+annum|\.?a\.?)(?!\s*(?:outgoings|sqm|psm))/i, fmt: v => `${v} p.a.` },
  { label: 'Rent-free period',    pat: /(\d+)[-\s]+months?\s+(?:rent[-\s]free|incentive)/i,                                                                                  fmt: v => `${v} months` },
  // Fitout / landlord contribution / dollar-amount incentive
  { label: 'Fitout contribution', pat: /\$([\d,]+(?:\.\d+)?)\s+(?:(?:fitout|landlord)\s+contribution|(?:cash\s+)?incentive\b)/i,                                        fmt: v => `$${v} (ex GST)` },
  { label: 'Bank guarantee',      pat: /(\d+)[-\s]+months?\s+bank\s+guarantee/i,                                                                                        fmt: v => `${v} months` },
  { label: 'Lease term',          pat: /(\d+)[-\s]+year\s+(?:initial\s+)?term/i,                                                                                        fmt: v => `${v} years` },
]
function parseSummaryTerms(summary) {
  const out = {}
  for (const { label, pat, fmt } of SUMMARY_PATS) {
    const m = (summary || '').match(pat)
    if (m) {
      const val = m.slice(1).find(g => g !== undefined)
      if (val) out[label] = fmt(val.trim().replace(/^AUD\s*/i, '$'))
    }
  }
  return out
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
  { key: 'rent_review_type',     label: 'Rent Review Type',     fmt: v => v || null,                                                      dir: 'neutral' },
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
  if (vA == null || vB == null) return 'na'
  if (field.dir === 'lower_better')        return vB < vA ? 'imp' : vB > vA ? 'risk' : 'same'
  if (field.dir === 'higher_better')       return vB > vA ? 'imp' : vB < vA ? 'risk' : 'same'
  if (field.dir === 'make_good')          { const rA = MG_RANK[vA] ?? 1, rB = MG_RANK[vB] ?? 1; return rB > rA ? 'imp' : rB < rA ? 'risk' : 'same' }
  if (field.dir === 'personal_guarantee') { const rA = PG_RANK[vA] ?? 0, rB = PG_RANK[vB] ?? 0; return rB > rA ? 'imp' : rB < rA ? 'risk' : 'same' }
  return 'mod'
}

const TRIVIAL_RE = /^[-_=*\s./\\|,~]+$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^(date|sign(?:ature|ed)?|initial[s]?|witness|executed|lessee|lessor)[:\s./_]*$/i

function isTrivialBlock(text) {
  const t = (text || '').trim()
  if (!t || t.length < 4) return true
  if (TRIVIAL_RE.test(t)) return true
  // Short all-caps labels with no numbers (e.g. "DATE", "SIGNED:", "LESSEE:")
  if (t.length <= 25 && /^[A-Z][A-Z\s:._/-]*$/.test(t) && !/\d/.test(t) && t.split(/\s+/).length <= 3) return true
  return false
}

export default function CompareTab({ negId, docs }) {
  const navigate = useNavigate()
  const sortedDocs = [...docs].sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))
  const docsKey = docs.map(d => d.id).join(',')

  const [leftIdx,  setLeftIdx]  = useState(Math.max(0, sortedDocs.length - 2))
  const [rightIdx, setRightIdx] = useState(sortedDocs.length - 1)
  const [picker,   setPicker]   = useState(null) // 'left' | 'right' | null
  const [comparison, setComparison] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // 'added'|'modified'|'removed'|null
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [addedGroupExpanded, setAddedGroupExpanded] = useState(false)
  const [compPolling, setCompPolling] = useState(false)
  const [compTimedOut, setCompTimedOut] = useState(false)

  const leftDoc  = sortedDocs[leftIdx]
  const rightDoc = sortedDocs[rightIdx]

  const ldA = leftDoc?.lease_data?.[0]
  const ldB = rightDoc?.lease_data?.[0]

  const pickerRef   = useRef(null)
  const pollRef     = useRef(null)
  const pollCountRef = useRef(0)

  // Reset to second-to-last vs last whenever the doc list changes (new upload arrives)
  useEffect(() => {
    setLeftIdx(Math.max(0, sortedDocs.length - 2))
    setRightIdx(sortedDocs.length - 1)
  }, [docsKey])

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

  // ── Summary terms (from AI report text, shown in commercial terms table) ────
  const leftReport  = leftDoc?.reports?.[0]?.report_json
  const rightReport = rightDoc?.reports?.[0]?.report_json
  const summaryTermsA = parseSummaryTerms(leftReport?.summary)
  const summaryTermsB = parseSummaryTerms(rightReport?.summary)
  const summaryTermRows = SUMMARY_PATS.reduce((acc, { label }) => {
    const vA = summaryTermsA[label], vB = summaryTermsB[label]
    if (vA || vB) acc.push({ label, vA, vB, changed: vA !== vB })
    return acc
  }, [])

  // ── Fetch stored comparison — poll until found (worker generates it after save_document) ──
  useEffect(() => {
    setActiveFilter(null)
    setComparison(null)
    setCompPolling(false)
    setCompTimedOut(false)
    pollCountRef.current = 0
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    if (!negId) return
    const leftId  = sortedDocs[leftIdx]?.id
    const rightId = sortedDocs[rightIdx]?.id
    if (!leftId || !rightId) return

    let stopped = false

    const doFetch = async () => {
      if (stopped) return
      const { data, error } = await supabase
        .from('comparisons')
        .select('id, result_json, matcher_version, created_at, document_id_v1, document_id_v2')
        .eq('negotiation_id', negId)
        .eq('document_id_v1', leftId)
        .eq('document_id_v2', rightId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) { console.error('comparisons fetch:', error.message); return }
      if (stopped) return
      if (data?.length) {
        setComparison(data[0])
        setCompPolling(false)
      } else if (pollCountRef.current < 120) {
        pollCountRef.current += 1
        setCompPolling(true)
        pollRef.current = setTimeout(doFetch, 3000)
      } else {
        setCompPolling(false)
        setCompTimedOut(true)
      }
    }

    doFetch()
    return () => {
      stopped = true
      if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    }
  }, [leftIdx, rightIdx, negId, docsKey])

  const handlePickVersion = (side, idx) => {
    if (side === 'left') { if (idx !== rightIdx) setLeftIdx(idx) }
    else                 { if (idx !== leftIdx)  setRightIdx(idx) }
    setPicker(null)
  }

  const toggleFilter = (f) => {
    setActiveFilter(prev => prev === f ? null : f)
  }

  const getFilteredRows = (rows) => {
    if (!rows) return rows
    let out = showUnchanged ? rows : rows.filter(r => r.change !== 'same')
    if (!activeFilter) return out
    return out.filter(r => {
      if (activeFilter === 'added')    return r.kind === 'added' || r.kind === 'added-group'
      if (activeFilter === 'removed')  return r.kind === 'removed'
      if (activeFilter === 'modified') return r.isMeaningful
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

  // ── Build display rows from stored result_json ────────────────────
  const displayRows = (() => {
    if (!comparison?.result_json || sameDocument) return []
    const rj = comparison.result_json
    const rows = []

    const MEANINGFUL = ['value_changed', 'substantive_change']

    // Schedule lines are short commercial-terms summary rows (e.g. "Incentive | 4 months")
    // already rendered in the Commercial Terms table above — skip them in the clause diff.
    const isScheduleLine = t => !!t && t.trim().length < 120 && t.includes(' | ') && !/^[\d"]/.test(t.trim())

    // Matched blocks sorted by V2 position, commercial-term duplicates removed
    const sorted = [...(rj.matches || [])]
      .filter(m => !(isScheduleLine(m.v1_text) && isScheduleLine(m.v2_text)))
      .sort((a, b) => a.v2_idx - b.v2_idx)
    for (const m of sorted) {
      const isModified = ['modified', 'topic'].includes(m.kind)
      const isMeaningful = isModified && MEANINGFUL.includes(m.change_type)
      const absD = Math.abs(m.delta)
      const maxLen = Math.max((m.v1_text || '').length, (m.v2_text || '').length)
      const isLabelledTerm = t => !!t && (t.includes(' | ') || /^\w[\w\s]+:\s/.test(t))
      const isShortClause = isModified && maxLen > 0 && maxLen < 120
        && !isLabelledTerm(m.v1_text) && !isLabelledTerm(m.v2_text)
      rows.push({
        kind:          m.kind,
        change_type:   m.change_type || null,
        change_summary: m.change_summary || null,
        change:        isModified ? 'watch' : 'same',
        left:          { text: m.v1_text },
        right:         { text: m.v2_text, tag: isModified ? 'modified' : m.kind === 'reordered' ? 'reordered' : 'unchanged' },
        textChanged:   isModified,
        note:          m.kind === 'reordered'
          ? `Block moved ${m.delta > 0 ? 'down' : 'up'} ${absD} position${absD !== 1 ? 's' : ''}`
          : isShortClause ? 'Short clause — this is the complete text as it appears in the document.'
          : null,
        isMeaningful,
      })
    }

    // Removed (V1 only)
    for (const r of (rj.removed || [])) {
      const cs = r.summary ? { label: r.label, summary: r.summary, significance: r.significance, tenant_impact: r.tenant_impact } : null
      rows.push({ kind: 'removed', change_type: null, change_summary: cs, change: 'watch', left: { text: r.text, tag: 'removed' }, right: null, textChanged: false, note: cs ? null : 'Removed in the revised version.', isMeaningful: true })
    }

    // Added (V2 only) — high-significance items shown individually; everything
    // else collapsed into a single expandable group so 500+ unmatched lease
    // clauses don't flood the comparison view.
    const addedBulkTexts = []
    for (const a of (rj.added || [])) {
      if (a.significance === 'high') {
        const cs = a.summary ? { label: a.label, summary: a.summary, significance: a.significance, tenant_impact: a.tenant_impact } : null
        rows.push({ kind: 'added', change_type: null, change_summary: cs, change: 'watch', left: null, right: { text: a.text, tag: 'new' }, textChanged: false, note: null, isMeaningful: true })
      } else {
        addedBulkTexts.push(a.text)
      }
    }
    if (addedBulkTexts.length > 0) {
      rows.push({ kind: 'added-group', count: addedBulkTexts.length, items: addedBulkTexts, change: 'watch', isMeaningful: true })
    }

    return rows.filter(row => {
      if (row.kind === 'added-group') return true
      if (row.change_summary?.summary) return true
      const text = (row.left?.text || row.right?.text || '').trim()
      return !isTrivialBlock(text)
    })
  })()

  const stats = comparison?.result_json?.stats

  return (
    <div className={styles.wrap}>

      {/* 1. COMPARISON SUMMARY — at the very top, filterable */}
      {comparison && !sameDocument && (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryLabel}>Comparison summary</span>
          <HelpTip>Source-text blocks compared between the two document versions. Modified blocks show word-level highlighting of what changed.</HelpTip>
          <div className={styles.summaryStats}>
            {[
              { key: 'added',    icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, cls: styles.sumIcoAdd, label: 'Added',    val: stats?.added    || 0 },
              { key: 'removed',  icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, cls: styles.sumIcoRem, label: 'Removed',  val: stats?.removed  || 0 },
              { key: 'modified', icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5L5 13.5 2 14l.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>, cls: styles.sumIcoMod, label: 'Modified', val: (stats?.value_changed || 0) + (stats?.substantive_change || 0) },
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
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendSame}`} />Unchanged</span>
            <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendBad}`} />Modified / Added / Removed</span>
          </div>
        </div>
      )}

      {/* 2. DOC SELECTOR — sits directly above clause columns */}
      <div className={styles.docSelect}>
        <DocCard side="left"  doc={leftDoc}  label="Previous version" labelCls={styles.vtagOrig} active={picker === 'left'} />
        <div className={styles.vsBadge}>VS</div>
        <DocCard side="right" doc={rightDoc} label="Revised version"  labelCls={styles.vtagRev}  active={picker === 'right'} />
      </div>

      {/* 3. COMMERCIAL TERMS — block-extracted (v2), lease_data, or summary-text fallback */}
      {((ldA || ldB) || (summaryTermRows.length > 0 && !sameDocument)) && (
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
                      {dir === 'na'   && <span className={styles.trmDirNa}>Not extracted</span>}
                    </td>
                  </tr>
                )
              })}
              {!ldA && !ldB && summaryTermRows.map(({ label, vA, vB, changed }) => (
                <tr key={label} className={changed ? styles.trmRowMod : styles.trmRowSame}>
                  <td className={styles.trmLabel}>{label}</td>
                  <td className={styles.trmVal}>{vA ?? <span className={styles.trmNil}>—</span>}</td>
                  <td className={styles.trmVal}>{vB ?? <span className={styles.trmNil}>—</span>}</td>
                  <td className={styles.trmDirCell}>{changed ? <span className={styles.trmDirMod}>Changed</span> : <span className={styles.trmDirSame}>Unchanged</span>}</td>
                </tr>
              ))}
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
      {!sameDocument && !comparison && hasLeftReport && hasRightReport && (
        compTimedOut ? (
          <div className={styles.noReport}>
            Taking longer than expected. Try refreshing the page — if this keeps happening, contact support.
          </div>
        ) : (
          <div className={styles.compLoading}>
            <span className={styles.compSpinner} />
            <div className={styles.compLoadText}>
              <span className={styles.compLoadTitle}>Generating comparison</span>
              <span className={styles.compLoadSub}>Matching clauses between v{leftDoc?.version_number} and v{rightDoc?.version_number} · Usually 1–3 minutes</span>
            </div>
          </div>
        )
      )}

      {/* 4. BLOCK COMPARISON — source-text blocks */}
      {comparison?.result_json && !sameDocument && (
        <div className={styles.comparePanel}>
          <div className={styles.compareHead}>
            <div className={styles.chSide}>
              <span className={styles.chT}>v{leftDoc?.version_number} — Previous</span>
            </div>
            <div className={styles.chSide}>
              <span className={styles.chT}>v{rightDoc?.version_number} — Revised</span>
            </div>
            <div className={styles.chNote}>What changed</div>
          </div>

          <div className={styles.crows}>
            {getFilteredRows(displayRows).map((row, i) => row.kind === 'added-group' ? (
              <div key={i} className={styles.addedGroup}>
                <div className={styles.addedGroupHeader}>
                  <span className={styles.tagNew}>Added</span>
                  <span className={styles.addedGroupLabel}>
                    {row.count} additional unmatched clause{row.count !== 1 ? 's' : ''} — present in the revised version with no counterpart in the previous version
                  </span>
                  <button className={styles.addedGroupToggle} onClick={() => setAddedGroupExpanded(p => !p)}>
                    {addedGroupExpanded ? 'Hide list ▴' : 'Show list ▾'}
                  </button>
                </div>
                {addedGroupExpanded && (
                  <div className={styles.addedGroupList}>
                    {row.items.map((text, idx) => (
                      <div key={idx} className={styles.addedGroupItem}>
                        <span className={styles.addedGroupN}>{idx + 1}</span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div key={i} className={styles.crow}>
                {row.left ? (
                  <div className={`${styles.ccard} ${dotCls[row.change]}`}>
                    <div className={styles.no}>{i + 1}</div>
                    <div className={styles.ccTt}>
                      {row.left.tag === 'removed' && (
                        <div className={styles.nm}><span className={styles.tagRm}>Removed</span></div>
                      )}
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
                        {row.right.tag === 'new'        && <span className={styles.tagNew}>Added</span>}
                        {row.right.tag === 'modified'   && <span className={styles.tagModified}>Modified</span>}
                        {row.right.tag === 'reordered'  && <span className={styles.tagModified}>Reordered</span>}
                        {row.right.tag === 'unchanged'  && <span className={styles.tagUnchanged}>Unchanged</span>}
                      </div>
                      <p>
                        {row.textChanged && row.left
                          ? <HighlightedText oldText={row.left.text} newText={row.right.text} />
                          : row.right.text}
                      </p>
                    </div>
                    <span className={styles.sdot} />
                  </div>
                ) : (
                  <div className={`${styles.ccard} ${styles.ccardEmpty}`}>Not in revised version</div>
                )}

                {row.change_summary?.summary ? (
                  <div className={`${styles.ccNote} ${styles.ccNoteMod}`}>
                    <span className={styles.noteLead}>
                      {row.change_summary.tenant_impact === 'favourable'   ? '↑ Favourable'   :
                       row.change_summary.tenant_impact === 'unfavourable' ? '↓ Unfavourable' :
                       row.kind === 'added' ? '+ Added' : row.kind === 'removed' ? '− Removed' : '~ Modified'}
                    </span>
                    {row.change_summary.label && <><strong>{row.change_summary.label}</strong>{' · '}</>}{row.change_summary.summary}
                    {row.change_summary.significance === 'high' && (
                      <span className={styles.sigHigh}>High impact</span>
                    )}
                  </div>
                ) : row.note ? (
                  <div className={`${styles.ccNote} ${styles.ccNoteMod}`}>
                    <span className={styles.noteLead}>
                      {row.kind === 'added'     ? '+ Added'      :
                       row.kind === 'removed'   ? '− Removed'    :
                       row.kind === 'reordered' ? '↕ Reordered'  :
                       '~ Modified'}
                    </span>
                    {row.note}
                  </div>
                ) : row.change === 'same' ? (
                  <div className={`${styles.ccNote} ${styles.ccNoteSame}`}>
                    <span className={styles.noteLead}>Unchanged</span>
                  </div>
                ) : (
                  <div className={`${styles.ccNote} ${styles.ccNoteMod}`}>
                    <span className={styles.noteLead}>
                      {row.kind === 'added'   ? '+ Added'   :
                       row.kind === 'removed' ? '− Removed' :
                       row.change_type === 'wording_only'  ? '~ Wording'  :
                       row.change_type === 'renumbered'    ? '# Renumbered' :
                       '~ Modified'}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {(() => {
              const unchangedCount = displayRows.filter(r => r.change === 'same' && r.kind !== 'added-group').length
              return unchangedCount > 0 && (
                <button className={styles.toggleUnchanged} onClick={() => setShowUnchanged(p => !p)}>
                  {showUnchanged
                    ? 'Hide unchanged blocks'
                    : `Show ${unchangedCount} unchanged block${unchangedCount !== 1 ? 's' : ''}`}
                </button>
              )
            })()}

            {displayRows.length === 0 && (
              <div className={styles.emptyFilter}>No changes found.</div>
            )}
            {displayRows.length > 0 && getFilteredRows(displayRows).length === 0 && (
              <div className={styles.emptyFilter}>No blocks match this filter.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
