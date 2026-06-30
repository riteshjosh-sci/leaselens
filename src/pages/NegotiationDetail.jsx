import { useEffect, useState } from 'react'
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

  const TABS = docs.length >= 2
    ? TABS_MULTI
    : guidedStep >= 2
      ? TABS_ONE_FULL
      : guidedStep === 1
        ? TABS_ONE_FULL.slice(0, 2)
        : TABS_ONE_FULL.slice(0, 1)
  // Derive active tab from URL hash or default to first tab
  const hashTab = location.hash.replace('#', '')
  const activeTab = TABS.find(t => t.key === hashTab)?.key || TABS[0].key

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
    const onFocus = () => fetchAll()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
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
        id, property_name, asset_class, created_at, status, lifecycle, workspace_id,
        documents (
          id, filename, version_number, doc_type, uploaded_at, overall_risk, file_path, is_deleted,
          reports ( id, report_json, created_at ),
          lease_data ( base_rent_annual, term_years, option_terms, bank_guarantee_months, make_good, marketing_levy_annual, fitout_contribution, rent_free_months, personal_guarantee, permitted_use, exclusivity, relocation_clause, outgoings_annual, rent_review_rate, rent_review_type )
        )
      `)
      .eq('id', negId)
      .single()

    if (error || !negData) { navigate('/dashboard'); return }
    setNeg(negData)
    setLifecycle(negData.lifecycle || 'reviewing')

    const sortedDocs = (negData.documents || []).filter(d => !d.is_deleted).sort((a, b) => b.version_number - a.version_number)
    setDocs(sortedDocs)

    if (negData.workspace_id) {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('id, name, client_name, logo_path, created_at')
        .eq('id', negData.workspace_id)
        .single()
      setWs(wsData)
    }

    setLoading(false)
  }

  // ── Derived clauses + decision state, lifted from ReviewTab ──────────────
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
  const openClauses       = allClauses.filter(c => !decisions[c.clauseKey] || decisions[c.clauseKey] === 'open')
  const counteringClauses = allClauses.filter(c => decisions[c.clauseKey] === 'countering')
  const agreedClauses     = allClauses.filter(c => decisions[c.clauseKey] === 'accepted')
  const decided           = counteringClauses.length + agreedClauses.length

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
              <h1 className={styles.wsName}>{neg.property_name || 'Unnamed negotiation'}</h1>
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

        {/* TAB CONTENT */}
        {activeTab === 'report' && (
          <ReportTab
            allClauses={allClauses}
            onNext={advanceToReview}
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
          />
        )}
        {activeTab === 'summary' && (
          <SummaryTab
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
