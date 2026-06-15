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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
  }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('negotiations')
        .select(`
          id, property_name, created_at, status, lifecycle,
          documents (
            id, filename, version_number, uploaded_at, overall_risk
          )
        `)
        .eq('workspace_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ])

    if (wsRes.error || !wsRes.data) { navigate('/dashboard'); return }
    setWs(wsRes.data)
    setNeg(negsRes.data || [])
    setLoading(false)
  }

  const handleDeleteNeg = async (negId, e) => {
    e.stopPropagation()
    if (!confirm('Delete this negotiation and all its documents?')) return
    await supabase.from('jobs').delete().eq('negotiation_id', negId)
    await supabase.from('negotiations').delete().eq('id', negId)
    setNeg(prev => prev.filter(n => n.id !== negId))
  }

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const getDocSummary = (neg) => {
    const docs = neg.documents || []
    const hoaCount   = docs.filter(d => d.filename?.toLowerCase().includes('hoa')).length
    const leaseCount = docs.filter(d => !d.filename?.toLowerCase().includes('hoa')).length
    const parts = []
    if (leaseCount > 0) parts.push(`${leaseCount} lease${leaseCount > 1 ? 's' : ''}`)
    if (hoaCount > 0)   parts.push(`${hoaCount} HOA${hoaCount > 1 ? 's' : ''}`)
    if (parts.length === 0 && docs.length > 0)
      parts.push(`${docs.length} document${docs.length > 1 ? 's' : ''}`)
    return { summary: parts.join(' · ') || 'No documents', total: docs.length }
  }

  const getStatusChip = (neg) => {
    const docs = neg.documents || []
    if (neg.lifecycle === 'agreed')          return { label: 'Agreed', cls: styles.statusDone }
    if (neg.lifecycle === 'awaiting')        return { label: 'Awaiting landlord', cls: styles.statusWait }
    if (neg.lifecycle === 'sent')            return { label: 'Sent to agent', cls: styles.statusWait }
    if (neg.lifecycle === 'counter_prepared') return { label: 'Counter prepared', cls: '' }
    if (docs.length === 0)                   return { label: 'No documents', cls: styles.statusMuted }
    return { label: 'Reviewing', cls: '' }
  }

  const getLatestDate = (neg) => {
    const docs = neg.documents || []
    if (!docs.length) return null
    return docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]?.uploaded_at
  }

  // Workspace-level status from all negotiations
  const getWsStatus = () => {
    if (!negotiations.length) return { label: 'No documents', cls: '' }
    if (negotiations.every(n => n.lifecycle === 'agreed')) return { label: 'Finalised', cls: styles.statusDone }
    if (negotiations.some(n => n.lifecycle === 'awaiting')) return { label: 'Awaiting landlord', cls: styles.statusWait }
    if (negotiations.some(n => n.lifecycle === 'counter_prepared')) return { label: 'Counter prepared', cls: '' }
    return { label: 'In review', cls: '' }
  }

  const totalDocs = negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const wsStatus  = getWsStatus()

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
            <div className={styles.wsBadge}>{ws.name[0]?.toUpperCase()}</div>
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
            <span className={`${styles.statusChip} ${wsStatus.cls}`}>
              <span className={styles.d} />{wsStatus.label}
            </span>
            <button
              className="btn-outline btn-sm"
              onClick={() => navigate(`/workspace/${id}/settings`)}
            >
              Settings
            </button>
            <button
              className="btn-ink btn-sm"
              onClick={() => navigate('/analyser', { state: { workspaceId: id } })}
            >
              + Analyse document
            </button>
          </div>
        </div>

        {/* NEGOTIATIONS */}
        <div className={styles.dsec}>
          <div className={styles.sh}>
            <span className={styles.shLbl}>Negotiations</span>
            <span className={styles.shCnt}>{negotiations.length} active</span>
            <span className={styles.shLn} />
          </div>

          {negotiations.length === 0 ? (
            <div className={styles.empty}>
              <p>No negotiations yet. Analyse a lease or HOA to get started.</p>
              <button
                className="btn-ink btn-sm"
                style={{ marginTop: 16 }}
                onClick={() => navigate('/analyser', { state: { workspaceId: id } })}
              >
                Analyse document →
              </button>
            </div>
          ) : (
            <div className={styles.wsGrid}>
              {negotiations.map(neg => {
                const status     = getStatusChip(neg)
                const { summary, total } = getDocSummary(neg)
                const latestDate = getLatestDate(neg)
                const cleanName  = (neg.property_name || 'Unnamed')
                  .replace(/^\d+_/, '')
                  .replace(/\.[^.]+$/, '')
                  .replace(/_/g, ' ')

                return (
                  <div
                    key={neg.id}
                    className={styles.wcard}
                    onClick={() => navigate(`/negotiation/${neg.id}`)}
                  >
                    <div className={styles.wcTop}>
                      <div className={styles.wcBadge}>
                        {cleanName[0]?.toUpperCase()}
                      </div>
                      <div className={styles.wcId}>
                        <div className={styles.wcName}>{cleanName}</div>
                        {ws.client_name && <div className={styles.wcTn}>{ws.client_name}</div>}
                      </div>
                      <span className={`${styles.negChip} ${status.cls}`}>
                        <span className={styles.d} />{status.label}
                      </span>
                    </div>

                    <div className={styles.wcSummary}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 1.5h5l3 3v10H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M9 1.5v3h3" stroke="currentColor" strokeWidth="1.4"/>
                      </svg>
                      {summary}
                      {total > 0 && <span className={styles.docsN}>· {total} document{total !== 1 ? 's' : ''}</span>}
                    </div>

                    <div className={styles.wcFoot}>
                      <span className={styles.wcUp}>
                        {latestDate ? `Updated ${formatDate(latestDate)}` : `Created ${formatDate(neg.created_at)}`}
                      </span>
                      <span className={styles.wcOpen}>Open →</span>
                    </div>

                    <button
                      className={styles.delBtn}
                      onClick={(e) => handleDeleteNeg(neg.id, e)}
                      title="Delete negotiation"
                    >✕</button>
                  </div>
                )
              })}

              {/* New negotiation card */}
              <div
                className={`${styles.wcard} ${styles.wcardNew}`}
                onClick={() => navigate('/analyser', { state: { workspaceId: id } })}
              >
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
