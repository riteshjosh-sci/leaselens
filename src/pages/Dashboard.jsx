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
  const [workspaces, setWorkspaces] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [wsModal, setWsModal] = useState(false)
  const [wsName, setWsName] = useState('')
  const [wsClient, setWsClient] = useState('')
  const [wsSaving, setWsSaving] = useState(false)

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const [wsRes, profileRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select(`
          id, name, client_name, logo_path, created_at,
          negotiations (
            id, status,
            documents (
              id, uploaded_at, overall_risk,
              reports ( id )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])
    setWorkspaces(wsRes.data || [])
    setProfile(profileRes.data)
    setLoading(false)
  }

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
      navigate(`/workspace/${data.id}`)
    }
    setWsName(''); setWsClient(''); setWsModal(false); setWsSaving(false)
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  // Derive workspace status from negotiations/docs
  const getStatus = (ws) => {
    const docs = ws.negotiations.flatMap(n => n.documents || [])
    if (docs.length === 0) return { label: 'No documents', cls: '' }
    const hasHigh = docs.some(d => d.overall_risk === 'HIGH')
    if (hasHigh) return { label: 'Needs attention', cls: 'raise' }
    return { label: 'Reviewing', cls: '' }
  }

  // Derive doc summary
  const getDocSummary = (ws) => {
    const allDocs = ws.negotiations.flatMap(n => n.documents || [])
    const hoaCount = ws.negotiations.filter(n =>
      n.documents?.some(d => d.filename?.toLowerCase().includes('hoa'))
    ).length
    const leaseCount = ws.negotiations.filter(n =>
      n.documents?.some(d => !d.filename?.toLowerCase().includes('hoa'))
    ).length
    const parts = []
    if (leaseCount > 0) parts.push(`${leaseCount} lease${leaseCount > 1 ? 's' : ''}`)
    if (hoaCount > 0) parts.push(`${hoaCount} HOA${hoaCount > 1 ? 's' : ''}`)
    if (parts.length === 0 && allDocs.length > 0) parts.push(`${allDocs.length} document${allDocs.length > 1 ? 's' : ''}`)
    return parts.join(' · ') || 'No documents'
  }

  const getLatestDate = (ws) => {
    const docs = ws.negotiations.flatMap(n => n.documents || [])
    if (!docs.length) return null
    const latest = docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]
    return latest?.uploaded_at
  }

  const totalDocs = workspaces.reduce((a, w) =>
    a + w.negotiations.reduce((b, n) => b + (n.documents?.length || 0), 0), 0)
  const totalNeg = workspaces.reduce((a, w) => a + w.negotiations.length, 0)

  // Separate active from finalised (no auto-detection yet, all active for now)
  const active = workspaces
  const finalised = []

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  const WCard = ({ ws }) => {
    const status = getStatus(ws)
    const docSummary = getDocSummary(ws)
    const latestDate = getLatestDate(ws)
    const allDocs = ws.negotiations.flatMap(n => n.documents || [])
    const docCount = allDocs.length

    return (
      <div className={styles.wcard} onClick={() => navigate(`/workspace/${ws.id}`)}>
        <div className={styles.wcTop}>
          <div className={styles.wcBadge}>{ws.name[0]?.toUpperCase()}</div>
          <div className={styles.wcId}>
            <div className={styles.wcName}>{ws.name}</div>
            {ws.client_name && <div className={styles.wcTn}>{ws.client_name}</div>}
          </div>
          {status.cls === 'raise' ? (
            <span className={`${styles.statusChip} ${styles.statusRaise}`}>
              <span className={styles.d} />Needs attention
            </span>
          ) : (
            <span className={styles.statusChip}>
              <span className={styles.d} />Reviewing
            </span>
          )}
        </div>
        <div className={styles.wcSummary}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 1.5h5l3 3v10H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M9 1.5v3h3" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          {docSummary}
          {docCount > 0 && <span className={styles.docsN}>· {docCount} document{docCount > 1 ? 's' : ''}</span>}
        </div>
        <div className={styles.wcFoot}>
          <span className={styles.wcUp}>{latestDate ? `Updated ${formatDate(latestDate)}` : 'No activity'}</span>
          <span className={styles.wcOpen}>Open →</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* HEAD */}
        <div className={styles.head}>
          <div>
            <h1 className={styles.h1}>Properties</h1>
            <div className={styles.summaryLine}>
              {active.length} in negotiation · {finalised.length} finalised · {totalDocs} document{totalDocs !== 1 ? 's' : ''} analysed
            </div>
          </div>
          <div className={styles.headActions}>
            <button className="btn-outline btn-sm" onClick={() => setWsModal(true)}>+ New property</button>
            <button className="btn-ink btn-sm" onClick={() => navigate('/analyser')}>+ Analyse document</button>
          </div>
        </div>

        {/* ACTIVE */}
        <div className={styles.dsec}>
          <div className={styles.sh}>
            <span className={styles.shLbl}>Active</span>
            <span className={styles.shCnt}>{active.length} in negotiation</span>
            <span className={styles.shLn} />
          </div>
          <div className={styles.wsGrid}>
            {active.map(ws => <WCard key={ws.id} ws={ws} />)}
            <div className={`${styles.wcard} ${styles.wcardNew}`} onClick={() => setWsModal(true)}>
              <div className={styles.plus}>+</div>
              <div className={styles.nt}>New property</div>
              <div className={styles.ns}>Start a workspace for a new tenancy</div>
            </div>
          </div>
        </div>

        {/* FINALISED */}
        {finalised.length > 0 && (
          <div className={styles.dsec}>
            <div className={styles.sh}>
              <span className={styles.shLbl}>Finalised</span>
              <span className={styles.shCnt}>{finalised.length} signed</span>
              <span className={styles.shLn} />
            </div>
            <div className={styles.wsGrid}>
              {finalised.map(ws => <WCard key={ws.id} ws={ws} />)}
            </div>
          </div>
        )}

        {/* UPGRADE */}
        {(profile?.plan === 'free' || profile?.plan === 'one_off') && (
          <div className={styles.upgradeBar}>
            <div>
              <strong>Upgrade to Professional</strong>
              <span> — unlimited scans, branded PDFs, client workspaces and more.</span>
            </div>
            <button className="btn-primary btn-sm" onClick={() => navigate('/pricing')}>View plans →</button>
          </div>
        )}

      </div>

      {/* CREATE MODAL */}
      {wsModal && (
        <div className={styles.overlay} onClick={() => setWsModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>New property</div>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label>Property name *</label>
                <input className="input" placeholder="e.g. Bondi Florist" value={wsName}
                  onChange={e => setWsName(e.target.value)} autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateWorkspace()} />
              </div>
              <div className={styles.field}>
                <label>Tenant name <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
                <input className="input" placeholder="e.g. Sydney Flowers Pty Ltd" value={wsClient}
                  onChange={e => setWsClient(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className="btn-ghost" onClick={() => setWsModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateWorkspace} disabled={wsSaving || !wsName.trim()}>
                {wsSaving ? 'Creating…' : 'Create property'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}