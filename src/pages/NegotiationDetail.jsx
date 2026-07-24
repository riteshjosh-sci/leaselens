import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import Tour from '../components/Tour'
import ReportTab from './ReportTab'
import ReviewTab from './ReviewTab'
import SummaryTab from './SummaryTab'
import CompareTab from './CompareTab'
import DocumentsTab from './DocumentsTab'
import ActivityTab from './ActivityTab'
import styles from './NegotiationDetail.module.css'

const TOUR_STEPS = [
  {
    target: 'neg-tabs',
    title: 'Five ways to work a negotiation',
    body: 'Compare versions side by side, review clauses one at a time, build a response summary, manage documents, or check the activity history.',
  },
  {
    target: 'neg-status',
    title: 'Status at a glance',
    body: 'Shows where this round stands — awaiting a reply, a counter prepared, or finalised.',
  },
  {
    target: 'neg-addversion',
    title: 'Add a new version',
    body: 'Uploaded a revised draft back from the landlord or agent? Add it here to compare against the last one.',
  },
]

const TABS_ONE_FULL = [
  { key: 'report',    label: 'Report' },
  { key: 'review',    label: 'Review' },
  { key: 'summary',   label: 'Summary' },
  { key: 'documents', label: 'Documents' },
  { key: 'activity',  label: 'Activity' },
]
const TABS_MULTI = [
  { key: 'compare',   label: 'Compare' },
  { key: 'report',    label: 'Report' },
  { key: 'review',    label: 'Review' },
  { key: 'summary',   label: 'Summary' },
  { key: 'documents', label: 'Documents' },
  { key: 'activity',  label: 'Activity' },
]

export default function NegotiationDetail() {
  const { id: negId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [neg,     setNeg]     = useState(null)
  const [ws,      setWs]      = useState(null)
  const [docs,    setDocs]    = useState([])
  const [loading, setLoading] = useState(true)

  const pollTimerRef       = useRef(null)
  const pollCountRef       = useRef(0)
  const awaitingVersionRef  = useRef(location.state?.awaitingVersion === true)
  const initialDocCountRef  = useRef(null)
  const [awaitingNewVersion, setAwaitingNewVersion] = useState(location.state?.awaitingVersion === true)
  const [docProcessing, setDocProcessing] = useState(false)

  // Lifted out of ReviewTab so this state survives switching to the Summary tab and
  // back — counter edits/selected options aren't persisted to the DB, only `decisions` is.
  const [decisions, setDecisions]             = useState({})
  const [counterEdits, setCounterEdits]       = useState({})
  const [resetKeys, setResetKeys]             = useState({})
  const [selectedOptions, setSelectedOptions] = useState({})
  const [activeId, setActiveId]               = useState(null)
  const [lifecycle, setLifecycle]             = useState('reviewing')
  const [copied, setCopied]                   = useState(false)
  const [guidedStep, setGuidedStep]           = useState(0)
  const [reviewDocId, setReviewDocId]         = useState(null)
  const [negEditing, setNegEditing]           = useState(false)
  const [negEditName, setNegEditName]         = useState('')

  const TABS = docs.length >= 2
    ? TABS_MULTI
    : guidedStep >= 2
      ? TABS_ONE_FULL
      : guidedStep === 1
        ? TABS_ONE_FULL.slice(0, 2)
        : TABS_ONE_FULL.slice(0, 1)
  // Derive active tab from URL hash; for completed negotiations default to summary
  const hashTab = location.hash.replace('#', '')
  const defaultTab = ['awaiting', 'sent', 'agreed'].includes(lifecycle) ? 'summary' : TABS[0].key
  const activeTab = TABS.find(t => t.key === hashTab)?.key || defaultTab

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    pollCountRef.current = 0
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
    fetchAll()
    const onFocus = () => fetchAll()
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
    }
  }, [negId, user])

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
          setGuidedStep(2)
        }
      })
  }, [negId])

  const fetchAll = async () => {
    const { data: negData, error } = await supabase
      .from('negotiations')
      .select(`
        id, property_name, tenant_name, premises_address, asset_class, created_at, status, lifecycle, workspace_id,
        documents (
          id, filename, version_number, doc_type, uploaded_at, overall_risk, file_path, is_deleted, content_hash,
          reports ( id, report_json, created_at )
        )
      `)
      .eq('id', negId)
      .maybeSingle()

    if (!negData) { navigate('/dashboard'); return }
    setNeg(negData)
    const lc = negData.lifecycle || 'reviewing'
    setLifecycle(lc)
    if (['awaiting', 'sent', 'agreed', 'counter_prepared'].includes(lc)) {
      setGuidedStep(s => Math.max(s, 2))
    }

    const sortedDocs = (negData.documents || []).filter(d => !d.is_deleted).sort((a, b) => b.version_number - a.version_number)

    // Fetch lease_data separately — nested select requires a declared FK constraint
    if (sortedDocs.length > 0) {
      const docIds = sortedDocs.map(d => d.id)
      const { data: ldRows } = await supabase
        .from('lease_data')
        .select('document_id, base_rent_annual, term_years, option_terms, bank_guarantee_months, make_good, marketing_levy_annual, fitout_contribution, rent_free_months, personal_guarantee, permitted_use, exclusivity, outgoings_annual, rent_review_rate, rent_review_type, total_annual_deal_value, state')
        .in('document_id', docIds)
      if (ldRows) {
        const ldByDoc = {}
        ldRows.forEach(ld => { ldByDoc[ld.document_id] = ld })
        sortedDocs.forEach(d => { d.lease_data = ldByDoc[d.id] ? [ldByDoc[d.id]] : [] })
      }
    }

    setDocs(sortedDocs)

    // Detect when the new doc lands and clear the awaiting state
    if (awaitingVersionRef.current) {
      if (initialDocCountRef.current === null) {
        initialDocCountRef.current = sortedDocs.length
      } else if (sortedDocs.length > initialDocCountRef.current) {
        setAwaitingNewVersion(false)
        awaitingVersionRef.current = false
        initialDocCountRef.current = null
      }
    }

    // Poll until every doc that exists has a report (worker saves asynchronously).
    // Also poll when no docs yet, or when returning from the analyser (any version upload).
    const allHaveReports = sortedDocs.length > 0 && sortedDocs.every(d => d.reports?.[0]?.report_json)
    const awaitingNewDoc = awaitingVersionRef.current && pollCountRef.current < 40
    if ((sortedDocs.length === 0 || !allHaveReports || awaitingNewDoc) && pollCountRef.current < 80) {
      pollCountRef.current += 1
      setDocProcessing(true)
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      pollTimerRef.current = setTimeout(fetchAll, 3000)
    } else {
      setDocProcessing(false)
      if (awaitingVersionRef.current) {
        setAwaitingNewVersion(false)
        awaitingVersionRef.current = false
        initialDocCountRef.current = null
      }
    }

    if (negData.workspace_id) {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('id, name, client_name, logo_path, created_at')
        .eq('id', negData.workspace_id)
        .single()
      let resolvedWs = wsData
      if (wsData?.name === 'New workspace') {
        const CLAUSE_WORDS = ['takes a lease', 'landlord', 'herein', 'pursuant', 'thereof', 'together with', 'non-exclusive', 'the term']
        const isClause = v => !v || v.length > 150 || CLAUSE_WORDS.some(w => v.toLowerCase().includes(w))
        const tenant  = !isClause(negData.tenant_name)       ? negData.tenant_name       : null
        const address = !isClause(negData.premises_address)  ? negData.premises_address  : null
        const friendly = tenant || address
        if (friendly) {
          supabase.from('workspaces').update({ name: friendly }).eq('id', wsData.id)
          resolvedWs = { ...wsData, name: friendly }
        }
      }
      setWs(resolvedWs)
    }

    setLoading(false)
  }

  // ── Derived clauses + decision state, lifted from ReviewTab ──────────────
  const reviewDoc = (reviewDocId ? docs.find(d => d.id === reviewDocId && d.reports?.[0]?.report_json) : null)
    || docs.find(d => d.reports?.[0]?.report_json)
    || null
  const docsWithReports = docs.filter(d => d.reports?.[0]?.report_json)

  const allClauses = reviewDoc
    ? (reviewDoc.reports[0].report_json.clauses || [])
        .map(c => ({
          ...c,
          clauseKey: `${reviewDoc.id}-${c.name}`,
          reportId: reviewDoc.reports[0].id,
        }))
        .sort((a, b) => {
          const isSC = loc => /^(SC[\s\d]|Special\s+Condition)/i.test(loc || '')
          const scA = isSC(a.location)
          const scB = isSC(b.location)
          if (scA !== scB) return scA ? 1 : -1
          // Within each group sort by numeric reference in location
          const numRe = /(\d+(?:\.\d+)?)/
          const numA = parseFloat((a.location || '').match(numRe)?.[1] ?? '9999')
          const numB = parseFloat((b.location || '').match(numRe)?.[1] ?? '9999')
          return numA - numB
        })
        // Remove duplicates — same clause name in multiple sections; keep first (main section, with legislation)
        .filter((c, idx, arr) => arr.findIndex(x => x.name === c.name) === idx)
        // Remove semantic duplicates — different clause names but identical counter proposal (AI extracted
        // the same issue from two places); keep first occurrence (earlier section position)
        .filter((c, idx, arr) => {
          const ct = (c.counter || '').trim()
          if (ct.length < 80) return true  // too short to be a reliable duplicate signal
          return arr.findIndex(x => (x.counter || '').trim() === ct) === idx
        })
    : []

  useEffect(() => {
    if (allClauses.length > 0) {
      setActiveId(allClauses[0]?.clauseKey)
    }
  }, [reviewDoc?.id])

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

  const handleSwitchReviewDoc = (docId) => {
    setReviewDocId(docId)
    setActiveId(null)
  }

  const handleRenameNeg = async () => {
    const name = negEditName.trim()
    if (name && name !== neg.property_name) {
      await supabase.from('negotiations').update({ property_name: name }).eq('id', negId)
      setNeg(prev => ({ ...prev, property_name: name }))
    }
    setNegEditing(false)
  }

  // Derived counts
  const openClauses       = allClauses.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')
  const counteringClauses = allClauses.filter(c => decisions[c.clauseKey] === 'countering')
  const agreedClauses     = allClauses.filter(c => decisions[c.clauseKey] === 'accepted')
  const decided           = counteringClauses.length + agreedClauses.length

  // Build copyable plain-text summary
  const buildSummary = () => {
    const prop = ws?.name || 'the property'
    const tenant = ws?.client_name ? ` (${ws.client_name})` : ''
    const lines = [`Lease review — ${prop}${tenant}`, '']
    lines.push('AGREED AS DRAFTED:')
    if (agreedClauses.length) {
      agreedClauses.forEach(c => {
        const label = c.location ? `${c.location}: ${c.name}` : c.name
        lines.push(`• ${label}`)
      })
    } else {
      lines.push('• None yet.')
    }
    lines.push('')
    lines.push('PROPOSED CHANGES:')
    if (counteringClauses.length) {
      counteringClauses.forEach(c => {
        const ct = getCounterText(c)
        const normalized = ct ? ct.replace(/\\n/g, ' ').replace(/\*\*/g, '').replace(/\n+/g, ' ').trim() : ''
        const label = c.location ? `${c.location}: ${c.name}` : c.name
        lines.push(`• ${label}${normalized ? ` — ${normalized}` : ''}`)
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

  const setTab = (key) => {
    navigate(`${location.pathname}#${key}`, { replace: true })
  }

  const advanceToReview = () => {
    setGuidedStep(s => Math.max(s, 1))
    setTab('review')
  }

  const advanceToSummary = () => {
    setGuidedStep(s => Math.max(s, 2))
    setTab('summary')
  }

  const handleAddVersion = (docType = null) => {
    navigate('/analyser', {
      state: {
        negotiationId: negId,
        workspaceId: ws?.id,
        prefill: {
          asset_class: neg?.asset_class || 'retail',
          doc_type: docType || 'hoa',
        },
      }
    })
  }

  // Status chip derived from lifecycle (the lifted state, so it updates immediately
  // when the user marks a negotiation as sent — not just after the next refetch)
  const getStatusChip = () => {
    if (!neg) return { label: 'Loading', cls: '' }
    const lc = lifecycle
    if (lc === 'agreed')            return { label: 'Agreed', cls: styles.statusDone }
    if (lc === 'awaiting')          return { label: 'Awaiting landlord', cls: styles.statusWait }
    if (lc === 'sent')              return { label: 'Sent to agent', cls: styles.statusWait }
    if (lc === 'counter_prepared')  return { label: 'Counter prepared', cls: styles.statusCounter }
    return { label: 'In review', cls: '' }
  }

  const status = getStatusChip()

  if (loading) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  return (
    <AppSidebar>
      <Tour steps={TOUR_STEPS} storageKey="ll_negotiation_tour_seen" />
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.crumb}>
          <button onClick={() => navigate('/properties')}>Properties</button>
          <span>›</span>
          {ws && (
            <>
              <button onClick={() => navigate(`/workspace/${ws.id}`)}>{ws.name}</button>
              <span>›</span>
            </>
          )}
          <span>{neg.property_name || 'Negotiation'}</span>
        </div>

        {/* WORKSPACE HEADER */}
        <div className={styles.wsHead}>
          <div className={styles.wsId}>
            <div className={styles.wsBadge}>{(neg.property_name || 'N')[0]?.toUpperCase()}</div>
            <div className={styles.wsNameWrap}>
              <div className={styles.wsKicker}>Negotiation</div>
              {negEditing ? (
                <input
                  className={`input ${styles.negRenameInput}`}
                  value={negEditName}
                  onChange={e => setNegEditName(e.target.value)}
                  onBlur={handleRenameNeg}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameNeg(); if (e.key === 'Escape') setNegEditing(false) }}
                  autoFocus
                />
              ) : (
                <div className={styles.wsNameRow}>
                  <h1 className={styles.wsName}>{neg.property_name || 'Unnamed negotiation'}</h1>
                  <button
                    className={styles.wsRenameBtn}
                    onClick={() => { setNegEditName(neg.property_name || ''); setNegEditing(true) }}
                    title="Rename negotiation"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5L5 13.5 2 14l.5-3L11 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              )}
              {ws?.client_name && <div className={styles.wsSub}>{ws.client_name}</div>}
            </div>
          </div>
          <div className={styles.wsActions}>
            <span className={`${styles.statusChip} ${status.cls}`} data-tour="neg-status">
              <span className={styles.statusD} />{status.label}
            </span>
            <button className="btn-outline btn-sm" data-tour="neg-addversion" onClick={() => handleAddVersion()}>
              + Add version
            </button>
          </div>
        </div>

        {/* TAB BAR */}
        <div className={styles.wstabs} data-tour="neg-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.wstab} ${activeTab === tab.key ? styles.wstabActive : ''}`}
              onClick={() => setTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'documents' && docs.length > 0 && (
                <span className={styles.wc}>{docs.length}</span>
              )}
            </button>
          ))}
        </div>

        {docProcessing && (docs.length < 2 || activeTab !== 'compare') && (
          <div className={styles.processingBanner}>
            <span className={styles.processingSpinner} />
            {docs.length >= 2
              ? 'Analysing revised version · Comparison will appear automatically when ready · Usually 3–5 minutes'
              : 'Analysing your document · This usually takes 2–4 minutes'}
          </div>
        )}

        {/* TAB CONTENT */}
        {activeTab === 'report' && (
          <ReportTab
            allClauses={allClauses}
            onNext={advanceToReview}
            leaseData={reviewDoc?.lease_data?.[0] || null}
            docType={reviewDoc?.doc_type || null}
          />
        )}
        {activeTab === 'review' && (
          <ReviewTab
            allClauses={allClauses}
            decisions={decisions}
            activeId={activeId}
            setActiveId={setActiveId}
            decideAndAdvance={decideAndAdvance}
            getCounterText={getCounterText}
            isEdited={isEdited}
            counterEdits={counterEdits}
            resetKeys={resetKeys}
            selectedOptions={selectedOptions}
            handleCounterEdit={handleCounterEdit}
            handleReset={handleReset}
            handleOptionSelect={handleOptionSelect}
            decided={decided}
            onViewSummary={advanceToSummary}
            reviewDoc={reviewDoc}
            docsWithReports={docsWithReports}
            onSwitchDoc={handleSwitchReviewDoc}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryTab
            negId={negId}
            ws={ws}
            allClauses={allClauses}
            openClauses={openClauses}
            counteringClauses={counteringClauses}
            agreedClauses={agreedClauses}
            getCounterText={getCounterText}
            isEdited={isEdited}
            lifecycle={lifecycle}
            updateLifecycle={updateLifecycle}
            copied={copied}
            handleCopy={handleCopy}
            buildSummary={buildSummary}
            onEditClause={(clauseKey) => { setActiveId(clauseKey); setTab('review') }}
            onBackToReview={() => setTab('review')}
          />
        )}
        {activeTab === 'compare' && (
          <CompareTab
            negId={negId}
            docs={docs}
            awaitingNewVersion={awaitingNewVersion}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab
            negId={negId}
            docs={docs}
            setDocs={setDocs}
            onAddVersion={handleAddVersion}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab
            neg={neg}
            docs={docs}
            ws={ws}
          />
        )}

      </div>
    </AppSidebar>
  )
}
