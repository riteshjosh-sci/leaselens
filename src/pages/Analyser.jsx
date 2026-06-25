import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import ClauseCard from '../components/ClauseCard'
import styles from './Analyser.module.css'

const LOADING_STAGES = [
  'Reviewing document...',
  'Extracting key clauses and conditions...',
  'Reviewing key terms, clauses and conditions...',
  'Comparing clauses to state legislation...',
  'Preparing your report...',
]

export default function Analyser() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const negotiationId = location.state?.negotiationId || null
  const workspaceId   = location.state?.workspaceId   || null
  const prefill       = location.state?.prefill       || {}

  const [profile, setProfile] = useState(null)
  const [leaseData, setLeaseData] = useState(null)
  const [docType, setDocType]   = useState(prefill.doc_type || 'hoa')
  const [includeCommercials, setIncludeCommercials] = useState(false)
  const [assetClass, setAssetClass] = useState(prefill.asset_class || 'retail')
  const [propertyType, setPropertyType] = useState(prefill.property_type || '')
  const [file, setFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [propertyName, setPropertyName] = useState('')
  const [showPropertyPrompt, setShowPropertyPrompt] = useState(false)
  const [matchPrompt, setMatchPrompt] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const fileInputRef = useRef()
  const stageIntervalRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const fallbackTimerRef = useRef(null)
  const jobSubscriptionRef = useRef(null)
  const negIdRef = useRef(null)
  const wsIdRef  = useRef(null)
  const completedRef = useRef(false)

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    }
    return () => {
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
      if (jobSubscriptionRef.current) jobSubscriptionRef.current.unsubscribe()
    }
  }, [user])

  const startLoadingCycle = () => {
    setLoadingStage(0)
    stageIntervalRef.current = setInterval(() => {
      setLoadingStage(prev => {
        if (prev >= LOADING_STAGES.length - 2) {
          clearInterval(stageIntervalRef.current)
          return LOADING_STAGES.length - 2
        }
        return prev + 1
      })
    }, 18000)
  }

  const stopLoadingCycle = () => {
    if (stageIntervalRef.current) { clearInterval(stageIntervalRef.current); stageIntervalRef.current = null }
  }

  const cleanupJob = () => {
    stopLoadingCycle()
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
    if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null }
    if (jobSubscriptionRef.current) { jobSubscriptionRef.current.unsubscribe(); jobSubscriptionRef.current = null }
  }

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
      setError('Please upload a PDF, Word, or text document.'); return
    }
    setFile(f); setError('')
  }

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }

  const handleJobUpdate = (jobData) => {
    if (completedRef.current) return
    if (jobData.stage === 'extracted' && jobData.stage_data) {
      try {
        const ld = typeof jobData.stage_data === 'string' ? JSON.parse(jobData.stage_data) : jobData.stage_data
        setLeaseData(ld); setLoadingStage(2)
      } catch (e) {}
    }
    if (jobData.stage === 'analysing') setLoadingStage(3)
    if (jobData.status === 'complete' && jobData.report_json) {
      completedRef.current = true
      cleanupJob()
      setLoadingStage(LOADING_STAGES.length - 1)
      setReport(jobData.report_json)
      setLoading(false)
      if (negotiationId) {
        // Came from existing negotiation — go to compare tab so user can see what changed
        setTimeout(() => navigate(`/negotiation/${negotiationId}#compare`), 1500)
      } else if (negIdRef.current && !negotiationId) {
        checkForExistingMatch(jobData.report_json)
      }
    } else if (jobData.status === 'failed') {
      completedRef.current = true
      cleanupJob()
      setError(jobData.error || 'Analysis failed. Please try again.')
      setLoading(false)
    }
  }

  const handleAnalyse = async () => {
    if (!file && pasteText.length < 100) {
      setError('Please upload a file or paste document text.'); return
    }

    if (user && profile) {
      const plan = profile.plan || 'free'
      if (plan === 'free' && (profile.free_scans_used || 0) >= 1) {
        setError('You have used your free scan this month. Upgrade to continue.'); return
      }
      if (plan === 'one_off' && (profile.scan_credits || 0) <= 0) {
        setError('No scan credits remaining. Purchase another report to continue.'); return
      }
      if ((plan === 'monthly' || plan === 'annual') && (profile.monthly_scans_used || 0) >= 10) {
        setError('You have reached your 10 scan limit for this month. Your limit resets on the 1st of next month.'); return
      }
    }

    completedRef.current = false
    negIdRef.current = null
    wsIdRef.current  = null
    setLoading(true); setError(''); setReport(null); setLeaseData(null)
    startLoadingCycle()

    try {
      let filePath = null
      let fileType = null
      let negId = negotiationId

      if (file) {
        fileType = file.name.split('.').pop().toLowerCase()
        if (fileType === 'doc') throw new Error('LEGACY_DOC')
        const uploadPath = `temp/${user?.id || 'anon'}/${Date.now()}_${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents').upload(uploadPath, file, { upsert: true })
        if (uploadError) throw new Error('Upload failed: ' + uploadError.message)
        filePath = uploadData.path
      }

      if (user && !negId) {
        const defaultName = file?.name?.replace(/\.[^/.]+$/, '') || 'New negotiation'

        // Auto-create a workspace if none was passed
        let wsId = workspaceId
        if (!wsId) {
          const { data: wsData } = await supabase.from('workspaces').insert({
            user_id: user.id,
            name: 'New workspace',
          }).select().single()
          if (wsData) { wsId = wsData.id; wsIdRef.current = wsData.id }
        }

        const { data: negData } = await supabase.from('negotiations').insert({
          user_id: user.id,
          property_name: defaultName,
          status: 'active',
          workspace_id: wsId || null,
        }).select().single()
        if (negData) { negId = negData.id; setPropertyName(defaultName) }
      }

      negIdRef.current = negId

      if (user && profile) {
        if (profile.plan === 'free') {
          await supabase.from('profiles').update({ free_scans_used: (profile.free_scans_used || 0) + 1 }).eq('id', user.id)
        } else if (profile.plan === 'one_off') {
          await supabase.from('profiles').update({ scan_credits: Math.max(0, (profile.scan_credits || 0) - 1) }).eq('id', user.id)
        } else if (profile.plan === 'monthly' || profile.plan === 'annual') {
          await supabase.from('profiles').update({ monthly_scans_used: (profile.monthly_scans_used || 0) + 1 }).eq('id', user.id)
        }
      }

      const { data: job, error: jobError } = await supabase.from('jobs').insert({
        user_id: user?.id || null,
        file_path: filePath,
        file_type: fileType,
        paste_text: pasteText || null,
        negotiation_id: negId || null,
        status: 'pending',
        asset_class: assetClass,
        property_type: propertyType || null,
        finalised: docType === 'lease',
        doc_type: docType,
        include_commercials: docType === 'hoa' ? true : includeCommercials,
      }).select().single()

      if (jobError) throw new Error('Failed to create job: ' + jobError.message)

      const subscription = supabase
        .channel(`job-${job.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${job.id}` },
          (payload) => { handleJobUpdate(payload.new) })
        .subscribe()

      jobSubscriptionRef.current = subscription

      // Immediate first poll at 3s to catch extracted stage
      setTimeout(async () => {
        const { data: jobData } = await supabase
          .from('jobs').select('status, stage, stage_data, report_json, error').eq('id', job.id).single()
        if (jobData && !completedRef.current) handleJobUpdate(jobData)
      }, 3000)

      pollIntervalRef.current = setInterval(async () => {
        if (completedRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; return }
        const { data: jobData } = await supabase
          .from('jobs').select('status, stage, stage_data, report_json, error').eq('id', job.id).single()
        if (jobData) handleJobUpdate(jobData)
      }, 2000)

      fallbackTimerRef.current = setTimeout(() => {
        if (completedRef.current) return
        cleanupJob()
        setError('Analysis is taking longer than expected. Please try again.')
        setLoading(false)
      }, 600000)

    } catch (e) {
      stopLoadingCycle()
      // Clean up any workspace/negotiation created during this attempt if it failed
      // before the job was saved — prevents ghost "New workspace" entries
      if (negIdRef.current && !negotiationId) {
        supabase.from('negotiations').delete().eq('id', negIdRef.current)
        if (wsIdRef.current) supabase.from('workspaces').delete().eq('id', wsIdRef.current)
        negIdRef.current = null
        wsIdRef.current  = null
      }
      setError(e.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // Check whether the just-analysed document's tenant + address match an
  // existing negotiation, so the user can fold it in rather than ending up
  // with two separate folders for the same deal.
  const checkForExistingMatch = async (reportJson) => {
    const tenant  = (reportJson?.tenant_name || '').trim().toLowerCase()
    const address = (reportJson?.premises_address || '').trim().toLowerCase()

    if (!tenant || !address || !user) { setShowPropertyPrompt(true); return }

    const { data: candidates } = await supabase
      .from('negotiations')
      .select('id, property_name, tenant_name, premises_address, workspace_id')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .neq('id', negIdRef.current)

    const match = candidates?.find(c =>
      (c.tenant_name || '').trim().toLowerCase() === tenant &&
      (c.premises_address || '').trim().toLowerCase() === address
    )

    if (match) setMatchPrompt(match)
    else setShowPropertyPrompt(true)
  }

  const handleMergeIntoExisting = async () => {
    if (!matchPrompt || !negIdRef.current) return
    setMatchLoading(true)
    const throwawayNegId = negIdRef.current
    const throwawayWsId  = wsIdRef.current
    const targetNegId    = matchPrompt.id

    const { data: doc } = await supabase
      .from('documents')
      .select('id, doc_type')
      .eq('negotiation_id', throwawayNegId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let reportId = null
    if (doc) {
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('negotiation_id', targetNegId)
        .eq('doc_type', doc.doc_type)

      await supabase.from('documents')
        .update({ negotiation_id: targetNegId, version_number: (count || 0) + 1 })
        .eq('id', doc.id)

      const { data: reportRow } = await supabase
        .from('reports').select('id').eq('document_id', doc.id).maybeSingle()
      reportId = reportRow?.id || null
    }

    await supabase.from('negotiations').delete().eq('id', throwawayNegId)
    if (throwawayWsId) await supabase.from('workspaces').delete().eq('id', throwawayWsId)

    setMatchLoading(false)
    setMatchPrompt(null)

    if (reportId) navigate(`/report/${reportId}`)
    else navigate(`/negotiation/${targetNegId}`)
  }

  const handleKeepSeparate = () => {
    setMatchPrompt(null)
    setShowPropertyPrompt(true)
  }

  const handleCreateNegotiation = async () => {
    if (!propertyName.trim() || !negIdRef.current) return

    const negId = negIdRef.current

    await supabase.from('negotiations')
      .update({ property_name: propertyName.trim() })
      .eq('id', negId)

    if (wsIdRef.current) {
      await supabase.from('workspaces')
        .update({ name: propertyName.trim() })
        .eq('id', wsIdRef.current)
        .eq('name', 'New workspace')
    }

    const { data: docs } = await supabase
      .from('documents')
      .select('id, reports(id)')
      .eq('negotiation_id', negId)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    setShowPropertyPrompt(false)
    const reportId = docs?.[0]?.reports?.[0]?.id
    if (reportId) {
      navigate(`/report/${reportId}`)
    } else if (wsIdRef.current) {
      navigate(`/workspace/${wsIdRef.current}`)
    } else {
      navigate('/dashboard')
    }
  }

  const riskBadge = (risk) => {
    const map = { HIGH: ['badge-high', '● High Risk'], MEDIUM: ['badge-medium', '● Medium Risk'], LOW: ['badge-low', '● Low Risk'] }
    const [cls, label] = map[risk] || map['MEDIUM']
    return <span className={`badge ${cls}`} style={{ fontSize: 12, padding: '5px 12px' }}>{label}</span>
  }

  const currentStageMsg = LOADING_STAGES[loadingStage]

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.main}>
          <button className={styles.back} onClick={() => navigate(-1)}>← Back</button>
          <h1 className={styles.h1}>Know what you're signing <em>before you sign.</em></h1>
          <p className={styles.sub}>Drag and drop your document below, or paste the text. LeaseLens analyses the terms and provides a clear outline of risk, impact and suggested response.</p>

          <div className={styles.card}>
            <div
              className={`${styles.zone} ${file ? styles.zoneLoaded : ''}`}
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <span className={styles.zoneIcon}>{file ? '✅' : '📄'}</span>
              <h3>{file ? 'File ready for analysis' : 'Drop your HOA or lease here'}</h3>
              <p>{file ? file.name : 'or click to browse · PDF, DOCX, TXT'}</p>
              {file && (
                <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setFile(null) }}>✕ Remove</button>
              )}
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.docx,.txt"
              onChange={e => handleFile(e.target.files[0])} />

            <div className={styles.metaInputs}>
              <div className={styles.metaRow}>
                <div className={styles.metaField}>
                  <label className={styles.metaLabel}>Document type</label>
                  <div className={styles.toggleRow}>
                    <button type="button"
                      className={`${styles.toggleBtn} ${docType === 'hoa' ? styles.toggleActive : ''}`}
                      onClick={() => setDocType('hoa')}>HOA</button>
                    <button type="button"
                      className={`${styles.toggleBtn} ${docType === 'lease' ? styles.toggleActive : ''}`}
                      onClick={() => setDocType('lease')}>Lease</button>
                  </div>
                  {docType === 'lease' && (
                    <label className={styles.checkRow}>
                      <input type="checkbox" checked={includeCommercials}
                        onChange={e => setIncludeCommercials(e.target.checked)} />
                      <span>Also review commercial terms</span>
                    </label>
                  )}
                </div>
                <div className={styles.metaField}>
                  <label className={styles.metaLabel}>Asset class</label>
                  <select className="input" value={assetClass} onChange={e => setAssetClass(e.target.value)}>
                    <option value="retail">Retail</option>
                    <option value="office">Office</option>
                    <option value="industrial">Industrial</option>
                    <option value="childcare">Childcare</option>
                    <option value="medical">Medical</option>
                  </select>
                </div>
                <div className={styles.metaField}>
                  <label className={styles.metaLabel}>Property type</label>
                  <select className="input" value={propertyType} onChange={e => setPropertyType(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="shopping_centre">Shopping Centre</option>
                    <option value="retail_strip">Retail Strip</option>
                    <option value="standalone">Standalone</option>
                    <option value="mixed_use">Mixed Use</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.pasteToggle}>
              <button onClick={() => setShowPaste(!showPaste)}>{showPaste ? 'Hide text paste' : 'or paste text instead'}</button>
            </div>
            {showPaste && (
              <textarea className={`input ${styles.textarea}`} value={pasteText}
                onChange={e => setPasteText(e.target.value)} placeholder="Paste the full text of your HOA here..." />
            )}

            <p className={styles.disclaimer}>
              By analysing a document you agree that LeaseLens may use anonymised clause data from your submission to improve future analysis. No personally identifying information is retained.
            </p>

            {error && error !== 'LEGACY_DOC' && <div className={styles.error}>{error}</div>}
            {error === 'LEGACY_DOC' && (
              <div className={styles.docError}>
                <strong>Legacy .doc format detected</strong>
                <p>This file is in the old Word format which cannot be processed directly. Please convert it:</p>
                <ol>
                  <li>Open in Microsoft Word or Google Docs</li>
                  <li>Save As <strong>.docx</strong> or export as <strong>PDF</strong></li>
                  <li>Upload the converted file here</li>
                </ol>
              </div>
            )}

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={handleAnalyse} disabled={loading}>
              {loading ? <><span className={styles.spinner} />{currentStageMsg}</> : 'Analyse my document'}
            </button>

            {loading && (
              <div className={styles.loadingStages}>
                <div className={styles.progressBarTrack}>
                  <div className={styles.progressBarFill}
                    style={{ width: `${Math.round(((loadingStage + 1) / LOADING_STAGES.length) * 100)}%` }} />
                </div>
                <div className={styles.progressMeta}>
                  <span className={styles.progressStage}>{LOADING_STAGES[loadingStage]}</span>
                  <span className={styles.progressPct}>{Math.round(((loadingStage + 1) / LOADING_STAGES.length) * 100)}%</span>
                </div>
                <div className={styles.loadingProgress}>
                  {LOADING_STAGES.map((stage, i) => (
                    <div key={i} className={`${styles.stageStep} ${i === loadingStage ? styles.stageActive : ''} ${i < loadingStage ? styles.stageDone : ''}`}>
                      <div className={styles.stageDot} /><span>{stage}</span>
                    </div>
                  ))}
                </div>
                <p className={styles.loadingNote}>Please keep this page open while your document is being analysed. This can take 1-3 minutes for larger documents.</p>
              </div>
            )}

            {!user && !loading && (
              <p className={styles.signInNudge}>
                <a href="/signup">Create a free account</a> to save your documents and track revisions.
              </p>
            )}
          </div>

          {/* LEASE SUMMARY CARD */}
          {leaseData && (loading || report) && (
            <div className={styles.leaseSummaryCard}>
              <div className={styles.leaseSummaryHeader}>
                <div className={styles.leaseSummaryKicker}>
                  {leaseData.security_clear !== false ? '✓ Document processed' : '⚠ Security flag detected'}
                </div>
                <div className={styles.leaseSummaryTitle}>
                  {leaseData.document_type || 'Lease'} — Commercial Terms Identified
                </div>
              </div>
              <div className={styles.leaseSummaryGrid}>
                {leaseData.term_years && (
                  <div className={styles.leaseSummaryItem}>
                    <span className={styles.leaseSummaryLabel}>Lease term</span>
                    <span className={styles.leaseSummaryValue}>{leaseData.term_years} years{leaseData.option_terms ? ` + ${leaseData.option_terms}` : ''}</span>
                  </div>
                )}
                {leaseData.base_rent_annual && (
                  <div className={styles.leaseSummaryItem}>
                    <span className={styles.leaseSummaryLabel}>Base rent</span>
                    <span className={styles.leaseSummaryValue}>${leaseData.base_rent_annual.toLocaleString()} pa</span>
                  </div>
                )}
                {leaseData.outgoings_annual && (
                  <div className={styles.leaseSummaryItem}>
                    <span className={styles.leaseSummaryLabel}>Outgoings</span>
                    <span className={styles.leaseSummaryValue}>${leaseData.outgoings_annual.toLocaleString()} pa</span>
                  </div>
                )}
                {leaseData.total_annual_deal_value && (
                  <div className={styles.leaseSummaryItem}>
                    <span className={styles.leaseSummaryLabel}>Total deal value</span>
                    <span className={styles.leaseSummaryValue}>${leaseData.total_annual_deal_value.toLocaleString()} pa</span>
                  </div>
                )}
                {leaseData.bank_guarantee_months && (
                  <div className={styles.leaseSummaryItem}>
                    <span className={styles.leaseSummaryLabel}>Bank guarantee</span>
                    <span className={styles.leaseSummaryValue}>{leaseData.bank_guarantee_months} months</span>
                  </div>
                )}
                {leaseData.rent_review_type && (
                  <div className={styles.leaseSummaryItem}>
                    <span className={styles.leaseSummaryLabel}>Rent review</span>
                    <span className={styles.leaseSummaryValue}>
                      {leaseData.rent_review_type.toUpperCase()}{leaseData.rent_review_rate ? ` ${leaseData.rent_review_rate}%` : ''}
                    </span>
                  </div>
                )}
                {leaseData.state && (
                  <div className={styles.leaseSummaryItem}>
                    <span className={styles.leaseSummaryLabel}>State</span>
                    <span className={styles.leaseSummaryValue}>{leaseData.state}</span>
                  </div>
                )}
              </div>
              <div className={styles.leaseSummaryStatus}>
                <span className={styles.leaseSummaryCheck}>✓ Commercial terms identified</span>
                {loading && <span className={styles.leaseSummaryPending}>◉ AI risk analysis running...</span>}
              </div>
            </div>
          )}

          {/* ANALYSIS COMPLETE BANNER */}
          {report && (
            <div style={{
              background: 'var(--risk-l-bg)',
              border: '1px solid #b8d8c4',
              borderLeft: '3px solid var(--risk-l)',
              borderRadius: 2,
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
              fontSize: 14,
              color: 'var(--risk-l)',
              fontWeight: 500,
            }}>
              <span style={{ fontSize: 18 }}>✓</span>
              Analysis complete — scroll down to view your report.
            </div>
          )}

          {/* EXISTING NEGOTIATION MATCH PROMPT */}
          {matchPrompt && report && (
            <div className={styles.propertyPrompt}>
              <h3>Looks like an existing negotiation</h3>
              <p>
                This document's tenant and address match <strong>{matchPrompt.property_name || 'an existing negotiation'}</strong>
                {matchPrompt.tenant_name ? ` (${matchPrompt.tenant_name}` : ''}
                {matchPrompt.premises_address ? `, ${matchPrompt.premises_address})` : matchPrompt.tenant_name ? ')' : ''}.
                Add this version to it, or keep it as a separate negotiation?
              </p>
              <div className={styles.propertyRow}>
                <button className="btn-primary" onClick={handleMergeIntoExisting} disabled={matchLoading}>
                  {matchLoading ? 'Adding…' : `Add to ${matchPrompt.property_name || 'existing'}`}
                </button>
                <button className="btn-outline" onClick={handleKeepSeparate} disabled={matchLoading}>Keep separate</button>
              </div>
            </div>
          )}

          {/* PROPERTY NAME PROMPT */}
          {showPropertyPrompt && report && (
            <div className={styles.propertyPrompt}>
              <h3>Report saved ✓</h3>
              <p>Give this property a name so you can find it easily in your dashboard (e.g. "Shop 4, Westfield Perth").</p>
              <div className={styles.propertyRow}>
                <input className="input" value={propertyName} onChange={e => setPropertyName(e.target.value)}
                  placeholder="Property or negotiation name" />
                <button className="btn-primary" onClick={handleCreateNegotiation} disabled={!propertyName.trim()}>Rename</button>
              </div>
            </div>
          )}

          {/* GUEST PREVIEW */}
          {report && !user && (
            <div className={styles.report}>
              <div className={styles.reportHeader}>
                <h2>Analysis Report</h2>
                {riskBadge(report.overall_risk)}
              </div>
              <div className={styles.summary}>{report.summary}</div>
              <div className={styles.freeStats}>
                {[
                  { label: 'High risk',     value: (report.clauses||[]).filter(c=>c.danger==='HIGH').length,   color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
                  { label: 'Medium risk',   value: (report.clauses||[]).filter(c=>c.danger==='MEDIUM').length, color: 'var(--gold)',   bg: 'var(--risk-m-bg)' },
                  { label: 'Low risk',      value: (report.clauses||[]).filter(c=>c.danger==='LOW').length,    color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
                  { label: 'Total clauses', value: (report.clauses||[]).length,                                color: 'var(--ink)',    bg: 'var(--white)'     },
                ].map(s => (
                  <div key={s.label} className={styles.freeStat} style={{ background: s.bg }}>
                    <div className={styles.freeStatValue} style={{ color: s.color }}>{s.value}</div>
                    <div className={styles.freeStatLabel}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className={styles.guestGate}>
                <div className={styles.guestBlur} aria-hidden="true">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={styles.fakeClause}>
                      <div className={styles.fakeClauseHeader} />
                      <div className={styles.fakeClauseBody} />
                    </div>
                  ))}
                </div>
                <div className={styles.guestOverlay}>
                  <div className={styles.guestLockIcon}>🔒</div>
                  <h3 className={styles.guestTitle}>See the full clause-by-clause report</h3>
                  <p className={styles.guestSub}>Create a free account to view every clause, the risk explained, and suggested counter positions.</p>
                  <div className={styles.guestActions}>
                    <a href="/signup" className="btn-primary" style={{ textDecoration: 'none' }}>Create free account →</a>
                    <a href="/login" className={styles.guestLogin}>Already have an account? Sign in</a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FREE TIER */}
          {report && user && profile?.plan === 'free' && (
            <div className={styles.freeResult}>
              <div className={styles.freeHeader}>
                <div className={styles.kicker}>Free scan complete</div>
                <h2 className={styles.freeTitle}>{report.clauses?.length || 0} clauses identified</h2>
                <div className={styles.freeSummary}>{report.summary}</div>
              </div>
              <div className={styles.freeStats}>
                {[
                  { label: 'High risk',   value: (report.clauses||[]).filter(c=>c.danger==='HIGH').length,   color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
                  { label: 'Medium risk', value: (report.clauses||[]).filter(c=>c.danger==='MEDIUM').length, color: 'var(--gold)',   bg: 'var(--risk-m-bg)' },
                  { label: 'Low risk',    value: (report.clauses||[]).filter(c=>c.danger==='LOW').length,    color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
                ].map(s => (
                  <div key={s.label} className={styles.freeStat} style={{ background: s.bg }}>
                    <div className={styles.freeStatValue} style={{ color: s.color }}>{s.value}</div>
                    <div className={styles.freeStatLabel}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className={styles.freeGate}>
                <h3>Unlock the full report</h3>
                <p>See every clause quoted from your document, the risk explained, and a suggested counter position for each issue.</p>
                <button className="btn-primary" onClick={() => navigate('/pricing')}>View pricing →</button>
              </div>
            </div>
          )}

          {/* FULL REPORT */}
          {report && user && profile?.plan !== 'free' && (
            <div className={styles.report}>
              <div className={styles.reportHeader}>
                <h2>Analysis Report</h2>
                {riskBadge(report.overall_risk)}
              </div>
              <div className={styles.summary}>{report.summary}</div>
              <div className={styles.sectionLabel}>Clause-by-clause findings</div>
              <div className={styles.clauses}>
                {(report.clauses || []).map((c, i) => <ClauseCard key={i} clause={c} />)}
              </div>
              <div className={styles.nextSteps}>
                <h3>Recommended next steps</h3>
                <ol>{(report.next_steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
              </div>
              <div className={styles.savedNote}>
                ✓ Report saved to your account. <a href="/dashboard">View all documents →</a>
              </div>
              <div className={styles.legalDisclaimer}>
                DISCLAIMER: LeaseLens is an AI-powered analysis tool. It is not legal advice. Always consult a qualified solicitor before signing any retail lease or heads of agreement.
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
