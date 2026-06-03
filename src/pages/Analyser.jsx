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

  const [profile, setProfile] = useState(null)
  const [assetClass, setAssetClass] = useState('retail')
  const [file, setFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [propertyName, setPropertyName] = useState('')
  const [showPropertyPrompt, setShowPropertyPrompt] = useState(false)
  const fileInputRef = useRef()
  const stageIntervalRef = useRef(null)
  const jobSubscriptionRef = useRef(null)

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    }
    return () => {
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current)
      if (jobSubscriptionRef.current) jobSubscriptionRef.current.unsubscribe()
    }
  }, [user])

  const startLoadingCycle = () => {
    setLoadingStage(0)
    stageIntervalRef.current = setInterval(() => {
      setLoadingStage(prev => {
        // Stop at second to last stage — last stage only shows when almost done
        if (prev >= LOADING_STAGES.length - 2) {
          clearInterval(stageIntervalRef.current)
          return LOADING_STAGES.length - 2
        }
        return prev + 1
      })
    }, 18000) // 18 seconds per stage — 4 stages = ~72 seconds total
  }

  const stopLoadingCycle = () => {
    if (stageIntervalRef.current) {
      clearInterval(stageIntervalRef.current)
      stageIntervalRef.current = null
    }
  }

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
      setError('Please upload a PDF, Word, or text document.')
      return
    }
    setFile(f)
    setError('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const handleJobUpdate = (jobData, subscription, negId) => {
    if (jobData.status === 'complete') {
      stopLoadingCycle()
      if (subscription) subscription.unsubscribe()
      setReport(jobData.report_json)
      setLoading(false)
      if (negId && !negotiationId) setShowPropertyPrompt(true)
    } else if (jobData.status === 'failed') {
      stopLoadingCycle()
      if (subscription) subscription.unsubscribe()
      setError(jobData.error || 'Analysis failed. Please try again.')
      setLoading(false)
    }
  }

  const handleAnalyse = async () => {
    if (!file && pasteText.length < 100) {
      setError('Please upload a file or paste document text.')
      return
    }

    // Feature gating
    if (user && profile) {
      const plan = profile.plan || 'free'
      if (plan === 'free' && (profile.free_scans_used || 0) >= 1) {
        setError('You have used your free scan this month. Upgrade to continue.')
        return
      }
      if (plan === 'one_off' && (profile.scan_credits || 0) <= 0) {
        setError('No scan credits remaining. Purchase another report to continue.')
        return
      }
      if ((plan === 'monthly' || plan === 'annual') && (profile.monthly_scans_used || 0) >= 10) {
        setError('You have reached your 10 scan limit for this month. Your limit resets on the 1st of next month.')
        return
      }
    }

    setLoading(true)
    setError('')
    setReport(null)
    startLoadingCycle()

    try {
      let filePath = null
      let fileType = null
      let negId = negotiationId

      // Upload file to Supabase Storage
      if (file) {
        fileType = file.name.split('.').pop().toLowerCase()

        if (fileType === 'doc') {
          throw new Error('LEGACY_DOC')
        }

        const uploadPath = `temp/${user?.id || 'anon'}/${Date.now()}_${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(uploadPath, file, { upsert: true })

        if (uploadError) throw new Error('Upload failed: ' + uploadError.message)
        filePath = uploadData.path
      }

      // Create or get negotiation
      if (user && !negId) {
        const defaultName = file?.name?.replace(/\.[^/.]+$/, '') || 'New negotiation'
        const { data: negData } = await supabase.from('negotiations').insert({
          user_id: user.id,
          property_name: defaultName,
          status: 'active',
        }).select().single()
        if (negData) {
          negId = negData.id
          setPropertyName(defaultName)
        }
      }

      // Update scan usage
      if (user && profile) {
        if (profile.plan === 'free') {
          await supabase.from('profiles').update({
            free_scans_used: (profile.free_scans_used || 0) + 1
          }).eq('id', user.id)
        } else if (profile.plan === 'one_off') {
          await supabase.from('profiles').update({
            scan_credits: Math.max(0, (profile.scan_credits || 0) - 1)
          }).eq('id', user.id)
        } else if (profile.plan === 'monthly' || profile.plan === 'annual') {
          await supabase.from('profiles').update({
            monthly_scans_used: (profile.monthly_scans_used || 0) + 1
          }).eq('id', user.id)
        }
      }

      // Create job in Supabase
      const { data: job, error: jobError } = await supabase.from('jobs').insert({
        user_id: user?.id || null,
        file_path: filePath,
        file_type: fileType,
        paste_text: pasteText || null,
        negotiation_id: negId || null,
        status: 'pending',
        asset_class: assetClass,
      }).select().single()

      if (jobError) throw new Error('Failed to create job: ' + jobError.message)

      // Trigger Railway worker (fire and forget)
      const workerUrl = import.meta.env.VITE_WORKER_URL
      if (workerUrl) {
        fetch(`${workerUrl}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id }),
        }).catch(console.error)
      }
      // Worker also polls automatically — no trigger needed if URL not set

      // Subscribe to job updates via Realtime
      const subscription = supabase
        .channel(`job-${job.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${job.id}`,
        }, async (payload) => {
          const updatedJob = payload.new
          handleJobUpdate(updatedJob, subscription, negId)
        })
        .subscribe()

      jobSubscriptionRef.current = subscription

      // Poll every 5 seconds as fallback in case Realtime misses the event
      // Check immediately first
      const checkJob = async () => {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('status, report_json, error')
          .eq('id', job.id)
          .single()
        if (jobData?.status === 'complete' || jobData?.status === 'failed') {
          clearInterval(pollInterval)
          handleJobUpdate(jobData, subscription, negId)
          return true
        }
        return false
      }
      // Start polling every 5 seconds
      const pollInterval = setInterval(async () => {
        await checkJob()
      }, 5000)

      // Fallback timeout — 10 minutes max
      setTimeout(() => {
        stopLoadingCycle()
        setError('Analysis is taking longer than expected. Please try again.')
        setLoading(false)
      }, 600000)

    } catch (e) {
      stopLoadingCycle()
      setError(e.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleCreateNegotiation = async () => {
    if (!propertyName.trim()) return
    const { data: negs } = await supabase
      .from('negotiations').select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (negs?.[0]) {
      await supabase.from('negotiations')
        .update({ property_name: propertyName.trim() })
        .eq('id', negs[0].id)
    }
    setShowPropertyPrompt(false)
  }

  const riskBadge = (risk) => {
    const map = {
      HIGH: ['badge-high', '● High Risk'],
      MEDIUM: ['badge-medium', '● Medium Risk'],
      LOW: ['badge-low', '● Low Risk']
    }
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
          <h1 className={styles.h1}>Know what you're signing <em>before you sign it.</em></h1>
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
                <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setFile(null) }}>
                  ✕ Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".pdf,.docx,.txt"
              onChange={e => handleFile(e.target.files[0])}
            />

            <div className={styles.assetClassRow}>
              <label className={styles.assetClassLabel}>Asset class</label>
              <select className="input" value={assetClass} onChange={e => setAssetClass(e.target.value)} style={{ maxWidth: 220 }}>
                <option value="retail">Retail</option>
                <option value="office">Office</option>
                <option value="industrial">Industrial</option>
                <option value="childcare">Childcare</option>
                <option value="medical">Medical</option>
              </select>
            </div>

            <div className={styles.pasteToggle}>
              <button onClick={() => setShowPaste(!showPaste)}>
                {showPaste ? 'Hide text paste' : 'or paste text instead'}
              </button>
            </div>
            {showPaste && (
              <textarea
                className={`input ${styles.textarea}`}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste the full text of your HOA here..."
              />
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

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={handleAnalyse}
              disabled={loading}
            >
              {loading
                ? <><span className={styles.spinner} />{currentStageMsg}</>
                : 'Analyse my document'
              }
            </button>

            {loading && (
              <div className={styles.loadingStages}>
                <div className={styles.progressBarTrack}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${Math.round(((loadingStage + 1) / LOADING_STAGES.length) * 100)}%` }}
                  />
                </div>
                <div className={styles.progressMeta}>
                  <span className={styles.progressStage}>{LOADING_STAGES[loadingStage]}</span>
                  <span className={styles.progressPct}>{Math.round(((loadingStage + 1) / LOADING_STAGES.length) * 100)}%</span>
                </div>
                <div className={styles.loadingProgress}>
                  {LOADING_STAGES.map((stage, i) => (
                    <div key={i} className={`${styles.stageStep} ${i === loadingStage ? styles.stageActive : ''} ${i < loadingStage ? styles.stageDone : ''}`}>
                      <div className={styles.stageDot} />
                      <span>{stage}</span>
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

          {/* PROPERTY NAME PROMPT */}
          {showPropertyPrompt && report && (
            <div className={styles.propertyPrompt}>
              <h3>Report saved ✓</h3>
              <p>Give this negotiation a name so you can find it easily (e.g. "Shop 4, Westfield Perth").</p>
              <div className={styles.propertyRow}>
                <input
                  className="input"
                  value={propertyName}
                  onChange={e => setPropertyName(e.target.value)}
                  placeholder="Property or negotiation name"
                />
                <button className="btn-primary" onClick={handleCreateNegotiation} disabled={!propertyName.trim()}>
                  Rename
                </button>
              </div>
            </div>
          )}

          {/* FREE TIER RESULT */}
          {report && profile?.plan === 'free' && (
            <div className={styles.freeResult}>
              <div className={styles.freeHeader}>
                <div className={styles.kicker}>Free scan complete</div>
                <h2 className={styles.freeTitle}>{report.clauses?.length || 0} clauses identified</h2>
                <div className={styles.freeSummary}>{report.summary}</div>
              </div>
              <div className={styles.freeStats}>
                {[
                  { label: 'High risk', value: (report.clauses||[]).filter(c=>c.danger==='HIGH').length, color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
                  { label: 'Medium risk', value: (report.clauses||[]).filter(c=>c.danger==='MEDIUM').length, color: 'var(--gold)', bg: 'var(--risk-m-bg)' },
                  { label: 'Low risk', value: (report.clauses||[]).filter(c=>c.danger==='LOW').length, color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
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
          {report && (!user || profile?.plan !== 'free') && (
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
              {user && (
                <div className={styles.savedNote}>
                  ✓ Report saved to your account. <a href="/dashboard">View all documents →</a>
                </div>
              )}
              {!user && (
                <div className={styles.savedNote} style={{ background: 'var(--gold-light)', borderColor: '#e0d5c0', color: 'var(--risk-m)' }}>
                  <a href="/signup">Create a free account</a> to save this report and track future revisions.
                </div>
              )}
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