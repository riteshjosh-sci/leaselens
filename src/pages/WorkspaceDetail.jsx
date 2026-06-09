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

  const [ws, setWs]               = useState(null)
  const [negotiations, setNeg]    = useState([])
  const [logoUrl, setLogoUrl]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [renaming, setRenaming]   = useState(null)
  const [renameVal, setRenameVal] = useState('')
  const [expanded, setExpanded]   = useState({})

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
    const negs = negsRes.data || []
    setNeg(negs)

    if (negs.length > 0) setExpanded({ [negs[0].id]: true })

    if (wsRes.data.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(wsRes.data.logo_path)
      setLogoUrl(urlData?.publicUrl || null)
    }

    setLoading(false)
  }

  // Fetch meta from the most recent job in a negotiation to prefill the analyser
  const getMetaForNeg = async (negId) => {
    const { data } = await supabase
      .from('jobs')
      .select('asset_class, property_type, landlord_type, suburb, postcode')
      .eq('negotiation_id', negId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return data || {}
  }

  // Navigate to analyser — workspace level (no existing negotiation)
  const handleAnalyseNew = async () => {
    // Try to get meta from the most recent negotiation in this workspace
    const lastNeg = negotiations[0]
    let meta = {}
    if (lastNeg) {
      meta = await getMetaForNeg(lastNeg.id)
    }
    navigate('/analyser', {
      state: {
        workspaceId: id,
        prefill: meta,
      }
    })
  }

  // Navigate to analyser — adding a new version to existing negotiation
  const handleAnalyseVersion = async (negId) => {
    const meta = await getMetaForNeg(negId)
    navigate('/analyser', {
      state: {
        negotiationId: negId,
        workspaceId: id,
        prefill: meta,
      }
    })
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

  const toggleExpanded = (negId) => setExpanded(prev => ({ ...prev, [negId]: !prev[negId] }))


  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const riskConfig = {
    HIGH:   { cls: 'badge badge-high',   dot: '#8b2020', label: 'HIGH' },
    MEDIUM: { cls: 'badge badge-medium', dot: '#b8975a', label: 'MED'  },
    LOW:    { cls: 'badge badge-low',    dot: '#1a5c30', label: 'LOW'  },
  }

  const totalDocs = negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const highCount = negotiations.reduce((a, n) =>
    a + (n.documents || []).filter(d => d.overall_risk === 'HIGH').length, 0)

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  return (
    <>
      <Nav />
      <div className={styles.page}>

        <div className={styles.breadcrumb}>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <span className={styles.breadSep}>›</span>
          <span>{ws.name}</span>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.heroMeta}>
              {logoUrl && <img src={logoUrl} alt="logo" className={styles.heroLogo} />}
              <div className={styles.heroKicker}>Workspace</div>
            </div>
            <h1 className={styles.heroTitle}>{ws.name}</h1>
            {ws.client_name && <div className={styles.heroClient}>{ws.client_name}</div>}
          </div>

          <div className={styles.heroRight}>
            <div className={styles.heroPills}>
              <div className={styles.heroPill}>
                <span className={styles.heroPillVal}>{negotiations.length}</span>
                <span className={styles.heroPillLabel}>Negotiations</span>
              </div>
              <div className={styles.heroPillDivider} />
              <div className={styles.heroPill}>
                <span className={styles.heroPillVal}>{totalDocs}</span>
                <span className={styles.heroPillLabel}>Documents</span>
              </div>
              {highCount > 0 && (
                <>
                  <div className={styles.heroPillDivider} />
                  <div className={styles.heroPill}>
                    <span className={styles.heroPillVal} style={{ color: 'var(--risk-h)' }}>{highCount}</span>
                    <span className={styles.heroPillLabel}>High risk</span>
                  </div>
                </>
              )}
            </div>

            <div className={styles.heroActions}>
              <button className={styles.settingsBtn} onClick={() => navigate(`/workspace/${id}/settings`)}>
                ⚙ Settings
              </button>
              <button className="btn-primary" onClick={handleAnalyseNew}>
                + Analyse document
              </button>
            </div>
          </div>
        </div>

        {negotiations.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyLine} />
            <div className={styles.emptyInner}>
              <div className={styles.emptyTitle}>No negotiations yet</div>
              <div className={styles.emptySub}>Upload your first lease or HOA to begin analysis.</div>
              <button className="btn-primary" onClick={handleAnalyseNew}>
                Analyse document →
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.negList}>
            {negotiations.map((neg, idx) => {
              const docs = (neg.documents || []).sort((a, b) => b.version_number - a.version_number)
              const latestRisk = docs[0]?.overall_risk
              const isOpen = !!expanded[neg.id]

              return (
                <div key={neg.id} className={`${styles.negCard} ${isOpen ? styles.negCardOpen : ''}`}>
                  <div className={styles.negRow} onClick={() => toggleExpanded(neg.id)}>
                    <div className={styles.negIndex}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className={styles.negMain}>
                      {renaming === neg.id ? (
                        <div className={styles.renameRow} onClick={e => e.stopPropagation()}>
                          <input className="input" value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRename(neg.id)}
                            autoFocus style={{ maxWidth: 320 }} />
                          <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => handleRename(neg.id)}>Save</button>
                          <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setRenaming(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className={styles.negTitle}>{neg.property_name || 'Unnamed negotiation'}</div>
                      )}
                      <div className={styles.negMeta}>
                        {formatDate(neg.created_at)} · {docs.length} version{docs.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {latestRisk && (
                      <div className={styles.negRisk}>
                        <span className={`badge ${riskConfig[latestRisk]?.cls?.split(' ')[1] || 'badge-medium'}`}>
                          {latestRisk}
                        </span>
                      </div>
                    )}
                    <div className={styles.negControls} onClick={e => e.stopPropagation()}>
                      {docs.length >= 2 && (
                        <button className={styles.controlBtn}
                          onClick={() => navigate(`/compare/${neg.id}`)}>Compare</button>
                      )}
                      <button className={styles.controlBtn}
                        onClick={() => handleAnalyseVersion(neg.id)}>
                        + Version
                      </button>
                      <button className={styles.controlBtn}
                        onClick={() => { setRenaming(neg.id); setRenameVal(neg.property_name || '') }}>
                        Rename
                      </button>
                      <button className={styles.controlDanger} onClick={() => handleDeleteNeg(neg.id)}>✕</button>
                    </div>
                    <div className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>›</div>
                  </div>

                  {isOpen && (
                    <div className={styles.docSection}>
                      {docs.map((doc, di) => (
                        <div key={doc.id} className={`${styles.docRow} ${di === 0 ? styles.docRowLatest : ''}`}>
                          <div className={styles.docVerBadge}>v{doc.version_number}</div>
                          <div className={styles.docInfo}>
                            <div className={styles.docName}>{stripTimestamp(doc.filename)}</div>
                            <div className={styles.docDate}>{formatDate(doc.uploaded_at)}</div>
                          </div>
                          {doc.overall_risk && (
                            <div className={styles.docRiskDot}
                              style={{ background: riskConfig[doc.overall_risk]?.dot }} />
                          )}
                          <div className={styles.docActions}>
                            {doc.reports?.[0]?.id ? (
                              <button className={styles.viewReportBtn}
                                onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                                View report →
                              </button>
                            ) : (
                              <span className={styles.processing}>Processing…</span>
                            )}
                            <button className={styles.docDelete}
                              onClick={() => handleDeleteDoc(doc.id, doc.file_path, neg.id)}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}