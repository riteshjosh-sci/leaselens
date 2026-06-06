import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces]   = useState([])
  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState({})       // workspace id → bool
  const [renaming, setRenaming]       = useState(null)     // neg id
  const [renameVal, setRenameVal]     = useState('')
  const [wsModal, setWsModal]         = useState(false)    // create workspace modal
  const [wsName, setWsName]           = useState('')
  const [wsClient, setWsClient]       = useState('')
  const [wsSaving, setWsSaving]       = useState(false)

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const [wsRes, profileRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select(`
          id, name, client_name, logo_path, delivery_email, created_at,
          negotiations (
            id, property_name, created_at, status,
            documents (
              id, filename, version_number, uploaded_at, overall_risk, file_path,
              reports ( id )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])

    const ws = wsRes.data || []
    setWorkspaces(ws)
    setProfile(profileRes.data)

    // Auto-expand if only one workspace (Default Workspace case)
    if (ws.length === 1) setExpanded({ [ws[0].id]: true })

    setLoading(false)
  }

  // ── Workspace actions ──────────────────────────────────────
  const handleCreateWorkspace = async () => {
    if (!wsName.trim()) return
    setWsSaving(true)
    const { data, error } = await supabase.from('workspaces').insert({
      user_id: user.id,
      name: wsName.trim(),
      client_name: wsClient.trim() || null,
    }).select().single()
    if (!error && data) {
      setWorkspaces(prev => [{ ...data, negotiations: [] }, ...prev])
      setExpanded(prev => ({ ...prev, [data.id]: true }))
    }
    setWsName(''); setWsClient(''); setWsModal(false); setWsSaving(false)
  }

  const handleDeleteWorkspace = async (wsId, negCount) => {
    const msg = negCount > 0
      ? `Delete this workspace and its ${negCount} negotiation(s)? Documents and reports will also be deleted.`
      : 'Delete this workspace?'
    if (!confirm(msg)) return
    // cascade: fetch all docs in this workspace's negotiations
    const ws = workspaces.find(w => w.id === wsId)
    const negs = ws?.negotiations || []
    for (const neg of negs) {
      const docs = neg.documents || []
      const filePaths = docs.map(d => d.file_path).filter(Boolean)
      if (filePaths.length) await supabase.storage.from('documents').remove(filePaths)
    }
    await supabase.from('workspaces').delete().eq('id', wsId)
    setWorkspaces(prev => prev.filter(w => w.id !== wsId))
  }

  // ── Negotiation actions ────────────────────────────────────
  const handleRename = async (negId, wsId) => {
    if (!renameVal.trim()) return
    await supabase.from('negotiations').update({ property_name: renameVal.trim() }).eq('id', negId)
    setWorkspaces(prev => prev.map(w => w.id !== wsId ? w : {
      ...w,
      negotiations: w.negotiations.map(n =>
        n.id === negId ? { ...n, property_name: renameVal.trim() } : n
      )
    }))
    setRenaming(null)
  }

  const handleDeleteNeg = async (negId, wsId) => {
    if (!confirm('Delete this negotiation and all its documents? This cannot be undone.')) return
    const ws = workspaces.find(w => w.id === wsId)
    const neg = ws?.negotiations?.find(n => n.id === negId)
    const docs = neg?.documents || []
    const filePaths = docs.map(d => d.file_path).filter(Boolean)
    if (filePaths.length) await supabase.storage.from('documents').remove(filePaths)
    await supabase.from('jobs').delete().eq('negotiation_id', negId)
    await supabase.from('negotiations').delete().eq('id', negId)
    setWorkspaces(prev => prev.map(w => w.id !== wsId ? w : {
      ...w,
      negotiations: w.negotiations.filter(n => n.id !== negId)
    }))
  }

  const handleDeleteDoc = async (docId, filePath, negId, wsId) => {
    if (!confirm('Delete this document and its report?')) return
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    await supabase.from('reports').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    setWorkspaces(prev => prev.map(w => w.id !== wsId ? w : {
      ...w,
      negotiations: w.negotiations.map(n => n.id !== negId ? n : {
        ...n,
        documents: n.documents.filter(d => d.id !== docId)
      })
    }))
  }

  // ── Helpers ────────────────────────────────────────────────
  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const riskClass = { HIGH: 'badge badge-high', MEDIUM: 'badge badge-medium', LOW: 'badge badge-low' }

  const totalScans = workspaces.reduce((acc, w) =>
    acc + w.negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0), 0)
  const scansAllowed = profile?.plan === 'professional' ? Infinity : profile?.plan === 'one_off' ? 1 : 3
  const scansLeft = Math.max(0, scansAllowed - (profile?.free_scans_used || 0))

  if (loading) return (
    <><Nav /><div className={styles.loading}>Loading dashboard...</div></>
  )

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* TOP BAR */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <div className={styles.pageSub}>{user?.email}</div>
          </div>
          <div className={styles.topActions}>
            <div className={styles.scanPill}>
              {profile?.plan === 'professional'
                ? <><strong>Unlimited</strong> scans</>
                : <><strong>{scansLeft}</strong> scan{scansLeft !== 1 ? 's' : ''} remaining</>}
            </div>
            {(profile?.plan === 'free' || profile?.plan === 'one_off') && (
              <button className={styles.upgradeBtn} onClick={() => navigate('/#pricing')}>Upgrade →</button>
            )}
            <button className={styles.newWsBtn} onClick={() => setWsModal(true)}>+ New workspace</button>
            <button className="btn-primary" onClick={() => navigate('/analyser')}>+ Analyse document</button>
          </div>
        </div>

        {/* EMPTY STATE */}
        {workspaces.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📁</div>
            <h2>No workspaces yet</h2>
            <p>Create a workspace for each client or site portfolio.</p>
            <button className="btn-primary" onClick={() => setWsModal(true)}>Create first workspace →</button>
          </div>
        ) : (
          <div className={styles.workspaceList}>
            {workspaces.map(ws => {
              const negCount = ws.negotiations?.length || 0
              const docCount = ws.negotiations?.reduce((a, n) => a + (n.documents?.length || 0), 0) || 0
              const isOpen = !!expanded[ws.id]

              return (
                <div key={ws.id} className={styles.workspace}>

                  {/* WORKSPACE HEADER */}
                  <div className={styles.wsHeader} onClick={() => setExpanded(prev => ({ ...prev, [ws.id]: !prev[ws.id] }))}>
                    <div className={styles.wsLeft}>
                      <span className={styles.wsChevron}>{isOpen ? '▾' : '▸'}</span>
                      <div>
                        <div className={styles.wsName}>{ws.name}</div>
                        {ws.client_name && <div className={styles.wsClient}>{ws.client_name}</div>}
                      </div>
                    </div>
                    <div className={styles.wsRight} onClick={e => e.stopPropagation()}>
                      <span className={styles.wsMeta}>{negCount} negotiation{negCount !== 1 ? 's' : ''} · {docCount} doc{docCount !== 1 ? 's' : ''}</span>
                      <button
                        className={styles.wsSettingsBtn}
                        onClick={() => navigate(`/workspace/${ws.id}`)}
                        title="Workspace settings"
                      >Settings</button>
                      <button
                        className={styles.wsDeleteBtn}
                        onClick={() => handleDeleteWorkspace(ws.id, negCount)}
                        title="Delete workspace"
                      >✕</button>
                    </div>
                  </div>

                  {/* NEGOTIATIONS */}
                  {isOpen && (
                    <div className={styles.wsBody}>
                      {negCount === 0 ? (
                        <div className={styles.wsEmpty}>
                          No negotiations yet.
                          <button className={styles.inlineBtn} onClick={() => navigate('/analyser')}>Analyse a document →</button>
                        </div>
                      ) : (
                        ws.negotiations.map(neg => (
                          <div key={neg.id} className={styles.negotiation}>

                            {/* Neg header */}
                            <div className={styles.negHeader}>
                              <div className={styles.negLeft}>
                                {renaming === neg.id ? (
                                  <div className={styles.renameRow}>
                                    <input
                                      className="input"
                                      value={renameVal}
                                      onChange={e => setRenameVal(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleRename(neg.id, ws.id)}
                                      autoFocus
                                    />
                                    <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => handleRename(neg.id, ws.id)}>Save</button>
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
                                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate(`/compare/${neg.id}`)}>Compare versions</button>
                                )}
                                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setRenaming(neg.id); setRenameVal(neg.property_name || '') }}>Rename</button>
                                <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => navigate('/analyser', { state: { negotiationId: neg.id, workspaceId: ws.id } })}>+ Add version</button>
                                <button className={styles.deleteBtn} onClick={() => handleDeleteNeg(neg.id, ws.id)}>✕</button>
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
                                        <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                                          View report
                                        </button>
                                      ) : (
                                        <span className={styles.processing}>Processing…</span>
                                      )}
                                      <button className={styles.deleteBtn} onClick={() => handleDeleteDoc(doc.id, doc.file_path, neg.id, ws.id)}>✕</button>
                                    </div>
                                  </div>
                                ))}
                            </div>

                          </div>
                        ))
                      )}
                      <div className={styles.wsFooter}>
                        <button className={styles.inlineBtn} onClick={() => navigate('/analyser', { state: { workspaceId: ws.id } })}>
                          + Analyse document in this workspace
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CREATE WORKSPACE MODAL */}
      {wsModal && (
        <div className={styles.overlay} onClick={() => setWsModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>New workspace</div>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label>Workspace name *</label>
                <input className="input" placeholder="e.g. Collins Street Portfolio" value={wsName} onChange={e => setWsName(e.target.value)} autoFocus />
              </div>
              <div className={styles.field}>
                <label>Client name <span style={{ fontWeight: 300, color: 'var(--ink-light)' }}>(optional)</span></label>
                <input className="input" placeholder="e.g. Acme Retail Pty Ltd" value={wsClient} onChange={e => setWsClient(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className="btn-ghost" onClick={() => setWsModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateWorkspace} disabled={wsSaving || !wsName.trim()}>
                {wsSaving ? 'Creating…' : 'Create workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}
