import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './WorkspacePage.module.css'

const MenuIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const ArrowIcon = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const DocIcon = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const SettingsIcon = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>

export default function WorkspacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ws, setWs] = useState(null)
  const [negotiations, setNeg] = useState([])
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { if (!user) { navigate('/login'); return } fetchAll() }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('negotiations').select(`
        id, property_name, created_at, status,
        documents ( id, filename, version_number, uploaded_at, overall_risk, file_path,
          reports ( id ) )
      `).eq('workspace_id', id).order('created_at', { ascending: false }),
    ])
    if (wsRes.error || !wsRes.data) { navigate('/dashboard'); return }
    setWs(wsRes.data)
    setNeg(negsRes.data || [])
    setLoading(false)
  }

  const getMetaForNeg = async (negId) => {
    const { data } = await supabase.from('jobs').select('asset_class, property_type, landlord_type, suburb, postcode')
      .eq('negotiation_id', negId).order('created_at', { ascending: false }).limit(1).single()
    return data || {}
  }

  const handleAnalyseNew = async () => {
    const lastNeg = negotiations[0]
    let meta = {}
    if (lastNeg) meta = await getMetaForNeg(lastNeg.id)
    navigate('/analyser', { state: { workspaceId: id, prefill: meta } })
  }

  const handleAnalyseVersion = async (negId) => {
    const meta = await getMetaForNeg(negId)
    navigate('/analyser', { state: { negotiationId: negId, workspaceId: id, prefill: meta } })
  }

  const handleDeleteNeg = async (negId) => {
    if (!confirm('Delete this negotiation and all its documents?')) return
    const neg = negotiations.find(n => n.id === negId)
    const filePaths = (neg?.documents || []).map(d => d.file_path).filter(Boolean)
    if (filePaths.length) await supabase.storage.from('documents').remove(filePaths)
    await supabase.from('jobs').delete().eq('negotiation_id', negId)
    await supabase.from('negotiations').delete().eq('id', negId)
    setNeg(prev => prev.filter(n => n.id !== negId))
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '').replace(/\.[^.]+$/, '') || ''
  const riskColor = { HIGH: 'var(--risk-h)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }
  const riskBg = { HIGH: 'var(--risk-h-bg)', MEDIUM: 'var(--risk-m-bg)', LOW: 'var(--risk-l-bg)' }

  const totalDocs = negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)

  const getStatus = (neg) => {
    const docs = neg.documents || []
    if (docs.some(d => d.overall_risk === 'HIGH')) return { label: 'Needs attention', cls: styles.statusHigh }
    if (docs.length === 0) return { label: 'No documents', cls: styles.statusNone }
    return { label: 'Reviewing', cls: styles.statusOk }
  }

  if (loading) return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main"><div className={styles.loading}><div className={styles.ring} /></div></main>
    </div>
  )

  return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main">

        {/* TOP BAR */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}><MenuIcon /></button>
            <div>
              <div className={styles.crumb}>
                <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                <span>›</span>
                <span>{ws.name}</span>
              </div>
              <h1 className={styles.h1}>{ws.name}</h1>
              {ws.client_name && <p className={styles.sub}>{ws.client_name}</p>}
            </div>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.stats}>
              <span><b>{negotiations.length}</b> negotiations</span>
              <span><b>{totalDocs}</b> documents</span>
            </div>
            <button className="btn-outline btn-sm" onClick={() => navigate(`/workspace/${id}/settings`)}>
              <SettingsIcon /> Settings
            </button>
            <button className="btn-gold btn-sm" onClick={handleAnalyseNew}>
              <PlusIcon /> Analyse document
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {/* SECTION HEADER */}
          <div className={styles.sectionHead}>
            <div className={styles.sh}>
              <span className={styles.shLbl}>Negotiations</span>
              <span className={styles.shCnt}>{negotiations.length} active</span>
              <span className={styles.shLn} />
            </div>
          </div>

          {/* NEGOTIATION GRID */}
          {negotiations.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><DocIcon /></div>
              <h3>No negotiations yet</h3>
              <p>Upload your first lease or HOA to begin analysis.</p>
              <button className="btn-gold" onClick={handleAnalyseNew}>Analyse document →</button>
            </div>
          ) : (
            <div className={styles.grid}>
              {negotiations.map(neg => {
                const docs = (neg.documents || []).sort((a, b) => b.version_number - a.version_number)
                const latestDoc = docs[0]
                const status = getStatus(neg)
                const cleanName = (neg.property_name || 'Unnamed').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

                return (
                  <div key={neg.id} className={styles.card} onClick={() => navigate(`/negotiation/${neg.id}`)}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardBadge}>{cleanName[0]?.toUpperCase()}</div>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardName}>{cleanName}</div>
                        {ws.client_name && <div className={styles.cardClient}>{ws.client_name}</div>}
                      </div>
                      <span className={`${styles.statusChip} ${status.cls}`}>{status.label}</span>
                    </div>

                    <div className={styles.cardDocs}>
                      <DocIcon />
                      <span>{docs.length} version{docs.length !== 1 ? 's' : ''}</span>
                      {latestDoc?.overall_risk && (
                        <span className={styles.riskPill} style={{ background: riskBg[latestDoc.overall_risk], color: riskColor[latestDoc.overall_risk] }}>
                          {latestDoc.overall_risk}
                        </span>
                      )}
                    </div>

                    <div className={styles.cardFoot}>
                      <span className={styles.cardDate}>
                        {latestDoc ? `Updated ${formatDate(latestDoc.uploaded_at)}` : `Created ${formatDate(neg.created_at)}`}
                      </span>
                      <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                        <button className={styles.versionBtn} onClick={() => handleAnalyseVersion(neg.id)}>+ Version</button>
                        <button className={styles.delBtn} onClick={() => handleDeleteNeg(neg.id)}>✕</button>
                      </div>
                      <span className={styles.openBtn}>Open <ArrowIcon /></span>
                    </div>
                  </div>
                )
              })}

              {/* New card */}
              <div className={`${styles.card} ${styles.cardNew}`} onClick={handleAnalyseNew}>
                <div className={styles.newPlus}>+</div>
                <div className={styles.newLabel}>New negotiation</div>
                <div className={styles.newSub}>Analyse a lease or HOA</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
