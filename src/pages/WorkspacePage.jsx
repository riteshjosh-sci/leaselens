import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './WorkspacePage.module.css'

export default function WorkspacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ws, setWs] = useState(null)
  const [negotiations, setNeg] = useState([])
  const [logoUrl, setLogoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [wsModal, setWsModal] = useState(false)
  const [negName, setNegName] = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
  }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('negotiations').select(`
        id, property_name, created_at, status,
        documents (
          id, filename, version_number, uploaded_at, overall_risk,
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

  const handleCreateNeg = async () => {
    if (!negName.trim()) return
    const { data } = await supabase.from('negotiations').insert({
      user_id: user.id,
      workspace_id: id,
      property_name: negName.trim(),
      status: 'active',
    }).select().single()
    if (data) {
      navigate('/analyser', { state: { negotiationId: data.id, workspaceId: id } })
    }
    setNegName(''); setWsModal(false)
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
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const getDocSummary = (neg) => {
    const docs = neg.documents || []
    const hasHoa = docs.some(d => d.filename?.toLowerCase().includes('hoa'))
    const hasLease = docs.some(d => !d.filename?.toLowerCase().includes('hoa'))
    const parts = []
    if (hasLease) parts.push('lease')
    if (hasHoa) parts.push('HOA')
    if (!parts.length && docs.length) parts.push(`${docs.length} document${docs.length > 1 ? 's' : ''}`)
    return parts.join(' · ') || 'No documents'
  }

  const getStatus = (neg) => {
    const docs = neg.documents || []
    const highRisk = docs.some(d => d.overall_risk === 'HIGH')
    if (highRisk) return { label: 'Needs attention', cls: styles.statusRaise }
    if (docs.length === 0) return { label: 'No documents', cls: '' }
    return { label: 'Reviewing', cls: '' }
  }

  const totalDocs = negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.crumb}>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <span>›</span>
          <span>{ws.name}</span>
        </div>

        {/* HEADER */}
        <div className={styles.head}>
          <div className={styles.headLeft}>
            {logoUrl
              ? <img src={logoUrl} alt="logo" className={styles.wsLogo} />
              : <div className={styles.wsBadge}>{ws.name[0]?.toUpperCase()}</div>
            }
            <div>
              <div className={styles.kicker}>Workspace</div>
              <h1 className={styles.h1}>{ws.name}</h1>
              {ws.client_name && <div className={styles.sub}>{ws.client_name}</div>}
              <div className={styles.meta}>
                {negotiations.length} negotiation{negotiations.length !== 1 ? 's' : ''} · {totalDocs} document{totalDocs !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className={styles.headActions}>
            <button className="btn-outline btn-sm"
              onClick={() => navigate(`/workspace/${id}/settings`)}>
              Settings
            </button>
            <button className="btn-ink btn-sm"
              onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
              + Analyse document
            </button>
          </div>
        </div>

        {/* NEGOTIATIONS GRID */}
        <div className={styles.dsec}>
          <div className={styles.sh}>
            <span className={styles.shLbl}>Negotiations</span>
            <span className={styles.shCnt}>{negotiations.length} active</span>
            <span className={styles.shLn} />
          </div>

          {negotiations.length === 0 ? (
            <div className={styles.empty}>
              <p>No negotiations yet. Analyse a lease or HOA to get started.</p>
              <button className="btn-ink btn-sm" style={{ marginTop: 16 }}
                onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
                Analyse document →
              </button>
            </div>
          ) : (
            <div className={styles.wsGrid}>
              {negotiations.map(neg => {
                const docs = (neg.documents || []).sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
                const latestDoc = docs[0]
                const docSummary = getDocSummary(neg)
                const status = getStatus(neg)
                const highCount = docs.filter(d => d.overall_risk === 'HIGH').length

                return (
                  <div key={neg.id} className={styles.wcard}
                    onClick={() => navigate(`/negotiation/${neg.id}`)}>
                    <div className={styles.wcTop}>
                      <div className={styles.wcBadge}>
                        {(neg.property_name?.replace(/^\d+_/, '') || 'N')[0]?.toUpperCase()}
                      </div>
                      <div className={styles.wcId}>
                        <div className={styles.wcName}>{(neg.property_name || 'Unnamed').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')}</div>
                        {ws.client_name && <div className={styles.wcTn}>{ws.client_name}</div>}
                      </div>
                      <span className={`${styles.statusChip} ${status.cls}`}>
                        <span className={styles.d} />
                        {status.label}
                      </span>
                    </div>

                    <div className={styles.wcSummary}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 1.5h5l3 3v10H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M9 1.5v3h3" stroke="currentColor" strokeWidth="1.4"/>
                      </svg>
                      {docSummary}
                      <span className={styles.docsN}>· {docs.length} document{docs.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className={styles.wcFoot}>
                      <span className={styles.wcUp}>
                        {latestDoc ? `Updated ${formatDate(latestDoc.uploaded_at)}` : `Created ${formatDate(neg.created_at)}`}
                      </span>
                      <span className={styles.wcOpen}>Open →</span>
                    </div>

                    <button className={styles.delBtn}
                      onClick={e => { e.stopPropagation(); handleDeleteNeg(neg.id) }}
                      title="Delete negotiation">✕</button>
                  </div>
                )
              })}

              {/* Add new */}
              <div className={`${styles.wcard} ${styles.wcardNew}`}
                onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
                <div className={styles.plus}>+</div>
                <div className={styles.nt}>New negotiation</div>
                <div className={styles.ns}>Analyse a lease or HOA for this workspace</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}