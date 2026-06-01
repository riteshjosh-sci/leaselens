import { useState, useRef, useEffect } from 'react'
import mammoth from 'mammoth'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import ClauseCard from '../components/ClauseCard'
import styles from './Analyser.module.css'


// Strip non-commercial content and cap document size
function preprocessDocText(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const filtered = []
  let skipMode = false
  const skipPatterns = [/^schedule\s+\d/i, /^annexure\s+[a-z\d]/i, /^appendix\s+[a-z\d]/i]

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { filtered.push(line); continue }
    if (skipPatterns.some(p => p.test(trimmed)) && trimmed.length < 80) { skipMode = true; continue }
    if (skipMode && /^(PART|CLAUSE|SECTION|\d+\.)\s+/i.test(trimmed) && trimmed.length < 120) skipMode = false
    if (!skipMode) filtered.push(line)
  }

  const result = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return result.length > 80000
    ? result.slice(0, 80000) + '\n\n[Document truncated — schedules and annexures omitted]'
    : result
}

export default function Analyser() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const negotiationId = location.state?.negotiationId || null

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    }
  }, [user])

  const [profile, setProfile] = useState(null)
  const [file, setFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [propertyName, setPropertyName] = useState('')
  const [showPropertyPrompt, setShowPropertyPrompt] = useState(false)
  const fileInputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf', 'doc', 'docx', 'txt'].includes(ext)) { setError('Please upload a PDF, Word, or text document.'); return }
    setFile(f)
    setError('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const handleAnalyse = async () => {
    if (!file && pasteText.length < 100) { setError('Please upload a file or paste document text.'); return }

    // Feature gating check
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
    }

    setLoading(true)
    setError('')
    setReport(null)
    setLoadingMsg('Reading your document...')

    try {
      let messages

      if (file) {
        const ext = file.name.split('.').pop().toLowerCase()

        if (ext === 'pdf') {
          // PDFs — send as base64, Claude reads natively
          const arrayBuffer = await file.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ''
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
          const base64 = btoa(binary)
          messages = [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: 'Analyse this retail lease or heads of agreement. Focus on all commercial terms, special conditions, and clauses that affect the tenant financially or operationally. Ignore schedules, annexures, plans, and standard boilerplate.' }
            ]
          }]
        } else if (ext === 'doc' || ext === 'docx') {
          // DOC/DOCX — extract text in browser with mammoth, send only text
          setLoadingMsg('Extracting document text...')
          const arrayBuffer = await file.arrayBuffer()
          let extractedText = ''
          try {
            const result = await mammoth.extractRawText({ arrayBuffer })
            extractedText = result.value
          } catch (e) {
            throw new Error('Could not read this Word document. Please try saving it as PDF and uploading again.')
          }

          if (!extractedText || extractedText.length < 100) {
            throw new Error('Could not extract text from this document. Please try saving as PDF and uploading again.')
          }

          // Strip schedules/annexures and cap at 80,000 chars
          const processed = preprocessDocText(extractedText)
          messages = [{
            role: 'user',
            content: `Analyse this retail lease or heads of agreement. Focus on all commercial terms, special conditions, and clauses that affect the tenant financially or operationally. Ignore schedules, annexures, plans, and standard boilerplate.\n\n${processed}`
          }]
        } else if (ext === 'txt') {
          const text = await file.text()
          messages = [{ role: 'user', content: `Analyse this retail lease or heads of agreement and return a JSON risk report:\n\n${text}` }]
        }
      } else {
        messages = [{ role: 'user', content: `Analyse this retail lease or heads of agreement and return a JSON risk report:\n\n${pasteText}` }]
      }

      setLoadingMsg('Reviewing your document. This can take a couple of minutes...')

      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })

      if (!res.ok) throw new Error('Analysis failed. Please try again.')
      const data = await res.json()
      const raw = data.content[0].text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')
      const parsed = JSON.parse(raw)

      setReport(parsed)

      // Save to Supabase if logged in
      if (user) {
        // Update scan usage
      if (profile?.plan === 'free') {
        await supabase.from('profiles').update({
          free_scans_used: (profile.free_scans_used || 0) + 1
        }).eq('id', user.id)
      } else if (profile?.plan === 'one_off') {
        await supabase.from('profiles').update({
          scan_credits: Math.max(0, (profile.scan_credits || 0) - 1)
        }).eq('id', user.id)
      }

      if (negotiationId) {
          // Adding to existing negotiation — save immediately
          await saveDocument(parsed, negotiationId)
        } else {
          // New negotiation — auto-create with filename as default name
          const defaultName = file?.name?.replace(/.[^/.]+$/, '') || 'New negotiation'
          const { data: negData } = await supabase.from('negotiations').insert({
            user_id: user.id,
            property_name: defaultName,
            status: 'active',
          }).select().single()
          if (negData) {
            await saveDocument(parsed, negData.id)
            // Show rename prompt so user can give it a proper name
            setPropertyName(defaultName)
            setShowPropertyPrompt(true)
          }
        }
      }

    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  const saveDocument = async (parsed, negId) => {
    try {
      let filePath = null
      if (file) {
        const path = `${user.id}/${negId}/${Date.now()}_${file.name}`
        const { data: uploadData } = await supabase.storage.from('documents').upload(path, file)
        filePath = uploadData?.path
      }

      const { data: countData } = await supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .eq('negotiation_id', negId)

      const versionNumber = (countData?.length || 0) + 1

      const { data: docData } = await supabase.from('documents').insert({
        negotiation_id: negId,
        user_id: user.id,
        filename: file?.name || 'pasted-document.txt',
        file_path: filePath,
        version_number: versionNumber,
        overall_risk: parsed.overall_risk,
        base_rent_psm: parsed.base_rent_psm || null,
        tenancy_size_sqm: parsed.tenancy_size_sqm || null,
        total_annual_rent: parsed.total_annual_rent || null,
      }).select().single()

      if (docData) {
        await supabase.from('reports').insert({
          document_id: docData.id,
          user_id: user.id,
          report_json: parsed,
        })
      }
    } catch (e) {
      console.error('Save failed:', e)
    }
  }

  const handleCreateNegotiation = async () => {
    if (!propertyName.trim()) return
    // Find the most recently created negotiation for this user and rename it
    const { data: negs } = await supabase
      .from('negotiations')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (negs?.[0]) {
      await supabase.from('negotiations').update({ property_name: propertyName.trim() }).eq('id', negs[0].id)
    }
    setShowPropertyPrompt(false)
  }

  const riskBadge = (risk) => {
    const map = { HIGH: ['badge-high', '● High Risk'], MEDIUM: ['badge-medium', '● Medium Risk'], LOW: ['badge-low', '● Low Risk'] }
    const [cls, label] = map[risk] || map['MEDIUM']
    return <span className={`badge ${cls}`} style={{ fontSize: 12, padding: '5px 12px' }}>{label}</span>
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.main}>
          <button className={styles.back} onClick={() => navigate(-1)}>← Back</button>
          <h1 className={styles.h1}>Know what you're signing <em>before you sign it.</em></h1>
          <p className={styles.sub}>Drag and drop your document below, or paste the text. LeaseLens analyses the terms and provides a clear outline of risk, impact and suggested response.</p>

          {/* UPLOAD CARD */}
          <div className={styles.card}>
            <div
              className={`${styles.zone} ${file ? styles.zoneLoaded : ''}`}
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <span className={styles.zoneIcon}>{file ? '✅' : '📄'}</span>
              <h3>{file ? 'File ready for analysis' : 'Drop your HOA or lease here'}</h3>
              <p>{file ? file.name : 'or click to browse · PDF, TXT, DOC, DOCX'}</p>
              {file && (
                <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setFile(null) }}>
                  ✕ Remove
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.txt,.doc,.docx" onChange={e => handleFile(e.target.files[0])} />

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

            {error && <div className={styles.error}>{error}</div>}

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={handleAnalyse}
              disabled={loading}
            >
              {loading ? (
                <><span className={styles.spinner} />{loadingMsg || 'Analysing...'}</>
              ) : 'Analyse my document'}
            </button>

            {!user && (
              <p className={styles.signInNudge}>
                <a href="/signup">Create a free account</a> to save your documents and track revisions.
              </p>
            )}
          </div>

          {/* PROPERTY NAME PROMPT (for new negotiations) */}
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

          {/* FREE TIER SCAN RESULT */}
          {report && profile?.plan === 'free' && !user?.isPaid && (
            <div className={styles.freeResult}>
              <div className={styles.freeHeader}>
                <div className={styles.kicker}>Free scan complete</div>
                <h2 className={styles.freeTitle}>
                  {report.clauses?.length || 0} clauses identified
                </h2>
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
                <button className="btn-primary" onClick={() => navigate('/pricing')}>
                  View pricing →
                </button>
              </div>
            </div>
          )}

        {/* FULL REPORT — paid users */}
          {report && profile?.plan !== 'free' && (
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
                <ol>
                  {(report.next_steps || []).map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>

              {user && (
                <div className={styles.savedNote}>
                  ✓ Report saved to your account. <a href="/dashboard">View all documents →</a>
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
