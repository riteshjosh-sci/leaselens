import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './WorkspaceDetail.module.css'

export default function WorkspaceDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ws, setWs]                 = useState(null)
  const [negotiations, setNeg]      = useState([])
  const [logoUrl, setLogoUrl]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [renaming, setRenaming]     = useState(null)
  const [renameVal, setRenameVal]   = useState('')

  useEffect(() => { if (!user) { navigate('/login'); return } fetchAll() }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('negotiations').select(`
        id, property_name, created_at, status,
        documents (
          id, filename, version_number, uploaded_at, overall_risk, file_path,
          reports ( id )
        )
      `).eq('workspace_id', id).order('created_at', { ascending: false }),
    ])

    if (wsRes.error || !wsRes.data) { navigate('/dashboard'); return }

    setWs(wsRes.data)
    setNeg(negsRes.data || [])

    if (wsRes.data.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(wsRes.data.logo_path)
      setLogoUrl(urlData?.publicUrl || null)
    }

    setLoading(false)
  }

  const handleRename = async (negId) => {
    if (!renameVal.trim()) return
    await supabase.from('negotiations').update({ property_name: renameVal.trim() }).eq('id', negId)
    setNeg(prev => prev.map(n => n.id === negId ? { ...n, property_name: renameVal.trim() } : n))
    setRenaming(null)
  }

  const handleDeleteNeg = async (negId) => {
    if (!confirm('Delete this negotiation and all its documents? This cannot be undone.')) return
    const neg = negotiations.find(n => n.id === negId)
    const filePaths = (neg?.documents || []).map(d => d.file_path).filter(Boolean)
    if (filePaths.length) await supabase.storage.from('documents').remove(filePaths)
    await supabase.from('jobs').delete().eq('negotiation_id', negId)
    await supabase.from('negotiations').delete().eq('id', negId)
    setNeg(prev => prev.filter(n => n.id !== negId))
  }

  const handleDeleteDoc = async (docId, filePath, negId) => {
    if (!confirm('Delete this document and its report?')) return
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    await supabase.from('reports').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    setNeg(prev => prev.map(n => n.id !== negId ? n : {
      ...n, documents: n.documents.filter(d => d.id !== docId)
    }))
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const riskClass = { HIGH: 'badge badge-high', MEDIUM: 'badge badge-medium', LOW: 'badge badge-low' }

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.breadcrumb}>
          <button onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <span>/</span>
          <span>{ws.name}</span>
        </div>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {logoUrl
              ? <img src={logoUrl} alt="logo" className={styles.headerLogo} />
              : <div className={styles.headerInitial}>{ws.name[0]?.toUpperCase()}</div>
            }
            <div>
              <h1 className={styles.h1}>{ws.name}</h1>
              {ws.client_name && <div className={styles.clientName}>{ws.client_name}</div>}
              <div className={styles.headerMeta}>
                {negotiations.length} negotiation{negotiations.length !== 1 ? 's' : ''} · {negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)} documents
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.settingsBtn} onClick={() => navigate(`/workspace/${id}/settings`)}>
              Settings
            </button>
            <button className="btn-primary" onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
              + Analyse document
            </button>
          </div>
        </div>

        {/* NEGOTIATIONS */}
        {negotiations.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📁</div>
            <h2>No negotiations yet</h2>
            <p>Analyse a document to create your first negotiation in this workspace.</p>
            <button className="btn-primary" onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
              Analyse document →
            </button>
          </div>
        ) : (
          <div className={styles.negList}>
            {negotiations.map(neg => (
              <div key={neg.id} className={styles.negotiation}>

                {/* Neg header */}
                <div className={styles.negHeader}>
                  <div className={styles.negLeft}>
                    {renaming === neg.id ? (
                      <div className={styles.renameRow}>
                        <input className="input" value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleRename(neg.id)}
                          autoFocus />
                        <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => handleRename(neg.id)}>Save</button>
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setRenaming(null)}>Cancel</button>
                      </div>
                    ) : (
                      <h2 className={styles.negTitle}>{neg.property_name || 'Unnamed negotiation'}</h2>
                    )}
                    <div className={styles.negMeta}>
                      Started {formatDate(neg.created_at)} · {neg.documents?.length || 0} version{neg.documents?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className={styles.negActions}>
                    {neg.documents?.length >= 2 && (
                      <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate(`/compare/${neg.id}`)}>
                        Compare versions
                      </button>
                    )}
                    <button className="btn-ghost" style={{ fontSize: 11 }}
                      onClick={() => { setRenaming(neg.id); setRenameVal(neg.property_name || '') }}>
                      Rename
                    </button>
                    <button className="btn-primary" style={{ fontSize: 11 }}
                      onClick={() => navigate('/analyser', { state: { negotiationId: neg.id, workspaceId: id } })}>
                      + Add version
                    </button>
                    <button className={styles.deleteBtn} onClick={() => handleDeleteNeg(neg.id)}>✕</button>
                  </div>
                </div>

                {/* Documents */}
                <div className={styles.docList}>
                  {(neg.documents || [])
                    .sort((a, b) => b.version_number - a.version_number)
                    .map(doc => (
                      <div key={doc.id} className={styles.docRow}>
                        <div className={styles.docVer}>v{doc.version_number}</div>
                        <div className={styles.docInfo}>
                          <div className={styles.docName}>{stripTimestamp(doc.filename)}</div>
                          <div className={styles.docDate}>{formatDate(doc.uploaded_at)}</div>
                        </div>
                        {doc.overall_risk && (
                          <span className={riskClass[doc.overall_risk] || 'badge badge-medium'}>
                            {doc.overall_risk}
                          </span>
                        )}
                        <div className={styles.docActions}>
                          {doc.reports?.[0]?.id ? (
                            <button className="btn-primary" style={{ fontSize: 11 }}
                              onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                              View report
                            </button>
                          ) : (
                            <span className={styles.processing}>Processing…</span>
                          )}
                          <button className={styles.deleteBtn}
                            onClick={() => handleDeleteDoc(doc.id, doc.file_path, neg.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}
