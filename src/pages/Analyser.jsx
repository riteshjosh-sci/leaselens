import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import ClauseCard from '../components/ClauseCard'
import styles from './Analyser.module.css'

export default function Analyser() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const negotiationId = location.state?.negotiationId || null

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

    setLoading(true)
    setError('')
    setReport(null)
    setLoadingMsg('Reading your document...')

    try {
      let messages

      if (file) {
        const ext = file.name.split('.').pop().toLowerCase()
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)
        const mediaType = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Analyse this retail lease or heads of agreement and return a JSON risk report. Focus only on commercial terms. Ignore drawings, plans, schedules, or technical specifications.' }
          ]
        }]
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

          {/* REPORT */}
          {report && (
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