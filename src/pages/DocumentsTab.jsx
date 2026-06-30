import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './NegotiationDetail.module.css'
import dStyles from './DocumentsTab.module.css'

export default function DocumentsTab({ negId, docs, setDocs, onAddVersion }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    }
  }, [user])

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Delete this document?')) return
    const { error } = await supabase.from('documents').update({ is_deleted: true }).eq('id', docId)
    if (error) { alert('Failed to delete document: ' + error.message); return }
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  const refetchDocs = async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, filename, version_number, doc_type, uploaded_at, overall_risk, file_path, reports ( id, report_json, created_at )')
      .eq('negotiation_id', negId)
      .eq('is_deleted', false)
    if (data) setDocs([...data].sort((a, b) => b.version_number - a.version_number))
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const riskPillCls = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }

  // Split by type — existing docs without doc_type fall into HOA column
  const hoaDocs   = [...docs].filter(d => !d.doc_type || d.doc_type === 'hoa').sort((a, b) => b.version_number - a.version_number)
  const leaseDocs = [...docs].filter(d => d.doc_type === 'lease').sort((a, b) => b.version_number - a.version_number)

  const UploadZone = ({ type, compact }) => {
    const [file, setFile] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const [includeCommercials, setIncludeCommercials] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [stageMsg, setStageMsg] = useState('')
    const [error, setError] = useState('')
    const fileInputRef = useRef()
    const pollRef = useRef(null)
    const fallbackRef = useRef(null)

    useEffect(() => () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (fallbackRef.current) clearTimeout(fallbackRef.current)
    }, [])

    const handleFile = (f) => {
      if (!f) return
      const ext = f.name.split('.').pop().toLowerCase()
      if (!['pdf', 'docx', 'txt'].includes(ext)) {
        setError('Please upload a PDF, Word (.docx), or text document.'); return
      }
      setFile(f); setError('')
    }

    const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }

    const cleanupPoll = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      if (fallbackRef.current) { clearTimeout(fallbackRef.current); fallbackRef.current = null }
    }

    const handleUpload = async () => {
      if (!file) return
      const wasFirstDoc = docs.length === 0

      if (profile) {
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

      setUploading(true); setError(''); setStageMsg('Uploading document...')

      try {
        const uploadPath = `temp/${user?.id || 'anon'}/${Date.now()}_${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents').upload(uploadPath, file, { upsert: true })
        if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

        if (profile) {
          if (profile.plan === 'free') {
            const next = (profile.free_scans_used || 0) + 1
            await supabase.from('profiles').update({ free_scans_used: next }).eq('id', user.id)
            setProfile(p => ({ ...p, free_scans_used: next }))
          } else if (profile.plan === 'one_off') {
            const next = Math.max(0, (profile.scan_credits || 0) - 1)
            await supabase.from('profiles').update({ scan_credits: next }).eq('id', user.id)
            setProfile(p => ({ ...p, scan_credits: next }))
          } else if (['monthly', 'annual', 'adviser'].includes(profile.plan)) {
            const next = (profile.monthly_scans_used || 0) + 1
            await supabase.from('profiles').update({ monthly_scans_used: next }).eq('id', user.id)
            setProfile(p => ({ ...p, monthly_scans_used: next }))
          }
        }

        const { data: job, error: jobError } = await supabase.from('jobs').insert({
          user_id: user?.id || null,
          file_path: uploadData.path,
          file_type: file.name.split('.').pop().toLowerCase(),
          negotiation_id: negId,
          status: 'pending',
          asset_class: 'retail',
          property_type: null,
          finalised: type === 'lease',
          doc_type: type,
          include_commercials: type === 'hoa' ? true : includeCommercials,
        }).select().single()

        if (jobError) throw new Error('Failed to create job: ' + jobError.message)

        setStageMsg('Analysing document...')

        const checkJob = async () => {
          const { data: jobData } = await supabase
            .from('jobs').select('status, error').eq('id', job.id).single()
          if (!jobData) return
          if (jobData.status === 'complete') {
            cleanupPoll()
            setUploading(false); setFile(null); setStageMsg('')
            await refetchDocs()
            navigate(`/negotiation/${negId}${wasFirstDoc ? '#report' : '#compare'}`)
          } else if (jobData.status === 'failed') {
            cleanupPoll()
            setUploading(false); setStageMsg('')
            setError(jobData.error || 'Analysis failed. Please try again.')
          }
        }

        pollRef.current = setInterval(checkJob, 2000)
        fallbackRef.current = setTimeout(() => {
          cleanupPoll()
          setUploading(false); setStageMsg('')
          setError('Analysis is taking longer than expected. Please check back shortly.')
        }, 600000)

      } catch (e) {
        setUploading(false); setStageMsg('')
        setError(e.message || 'Something went wrong. Please try again.')
      }
    }

    return (
      <div className={`${dStyles.dropZone} ${compact ? dStyles.dropZoneCompact : ''}`}>
        <div
          className={`${dStyles.dropArea} ${dragOver ? dStyles.dropAreaOver : ''} ${file ? dStyles.dropAreaLoaded : ''}`}
          onClick={() => !uploading && fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <span className={dStyles.dropIcon}>{file ? '✅' : '📄'}</span>
          <p className={dStyles.dropTitle}>
            {file ? file.name : `Drop your ${type === 'hoa' ? 'HOA' : 'lease'} here, or click to browse`}
          </p>
          {!file && <p className={dStyles.dropSub}>PDF, DOCX, TXT</p>}
        </div>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.docx,.txt"
          onChange={e => handleFile(e.target.files[0])} />

        {type === 'lease' && file && (
          <label className={dStyles.dropCheck}>
            <input type="checkbox" checked={includeCommercials}
              onChange={e => setIncludeCommercials(e.target.checked)} />
            <span>Also review commercial terms</span>
          </label>
        )}

        {error && <div className={dStyles.dropError}>{error}</div>}

        {file && !uploading && (
          <button className="btn-ink btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
            onClick={handleUpload}>
            Analyse {type === 'hoa' ? 'HOA' : 'lease'} →
          </button>
        )}
        {uploading && (
          <div className={dStyles.dropProgress}>
            <span className={dStyles.dropSpinner} />
            {stageMsg}
          </div>
        )}
      </div>
    )
  }

  const DocList = ({ list, type }) => (
    <div className={dStyles.col}>
      <div className={dStyles.colHead}>
        <div className={dStyles.colTitleWrap}>
          <span className={dStyles.colBar} />
          <span className={dStyles.colTitle}>{type === 'hoa' ? 'Heads of Agreement' : 'Lease'}</span>
        </div>
        <button className="btn-outline btn-sm" onClick={() => onAddVersion(type)}>
          Open in Analyser →
        </button>
      </div>

      <div className={dStyles.colBody}>
        {list.length === 0 ? (
          <>
            <p className={dStyles.colEmptySub} style={{ marginBottom: 12 }}>
              {type === 'hoa'
                ? 'Upload the heads of agreement to start tracking this negotiation.'
                : 'Once the HOA settles, upload the draft lease to track it against agreed terms.'}
            </p>
            <UploadZone type={type} />
          </>
        ) : (
          <>
            <UploadZone type={type} compact />
            <div className={dStyles.docList}>
              {list.map((doc, i) => (
                <div key={doc.id} className={dStyles.docRow}>
                  <div className={dStyles.fic}>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
                  <div className={dStyles.dm}>
                    <div className={dStyles.docRole}>
                      V{doc.version_number} · {i === 0 ? 'current' : 'superseded'}
                    </div>
                    <div className={dStyles.docFn}>{stripTimestamp(doc.filename)}</div>
                    <div className={dStyles.docMeta}>{formatDate(doc.uploaded_at)}</div>
                  </div>
                  <div className={dStyles.pills}>
                    {i === 0 && <span className={dStyles.pillCur}>Current</span>}
                    {doc.overall_risk && (
                      <span className={`${styles.pill} ${riskPillCls[doc.overall_risk]}`}>{doc.overall_risk}</span>
                    )}
                  </div>
                  <div className={dStyles.docActions}>
                    {doc.reports?.[0]?.id ? (
                      <button className="btn-outline btn-sm" onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                        View report →
                      </button>
                    ) : (
                      <span className={dStyles.processing}>Processing…</span>
                    )}
                    <button className={dStyles.delBtn} onClick={() => handleDeleteDoc(doc.id)} title="Delete">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className={dStyles.wrap}>
      <div className={dStyles.head}>
        <div>
          <div className={dStyles.title}>Documents</div>
          <div className={dStyles.sub}>HOA and Lease documents for this negotiation, tracked separately.</div>
        </div>
      </div>

      <div className={dStyles.columns}>
        <DocList list={hoaDocs}   type="hoa" />
        <DocList list={leaseDocs} type="lease" />
      </div>
    </div>
  )
}
