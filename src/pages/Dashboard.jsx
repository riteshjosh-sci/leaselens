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
  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [wsModal, setWsModal]       = useState(false)
  const [wsName, setWsName]         = useState('')
  const [wsClient, setWsClient]     = useState('')
  const [wsSaving, setWsSaving]     = useState(false)
  const [sortPref, setSortPref]     = useState('property') // 'property' | 'tenant'

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const [wsRes, profileRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select(`
          id, name, client_name, logo_path, created_at,
          negotiations (
            id, status, lifecycle,
            documents (
              id, filename, uploaded_at, overall_risk
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])
    setWorkspaces(wsRes.data || [])
    const p = profileRes.data
    setProfile(p)
    if (p?.sort_preference) setSortPref(p.sort_preference)
    setLoading(false)
  }

  const handleSortPref = async (pref) => {
    setSortPref(pref)
    await supabase.from('profiles').update({ sort_preference: pref }).eq('id', user.id)
  }

  const handleCreateWorkspace = async () => {
    if (!wsName.trim()) return
    setWsSaving(true)
    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        user_id: user.id,
        name: wsName.trim(),
        client_name: wsClient.trim() || null,
      })
      .select()
      .single()
    if (!error && data) {
      setWorkspaces(prev => [{ ...data, negotiations: [] }, ...prev])
      navigate(`/workspace/${data.id}`)
    }
    setWsName(''); setWsClient(''); setWsModal(false); setWsSaving(false)
  }

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const getStatusChip = (ws) => {
    const negs = ws.negotiations || []
    if (negs.length === 0) return { label: 'No documents', cls: '' }
    const lifecycles = negs.map(n => n.lifecycle)
    if (negs.every(n => n.lifecycle === 'agreed'))       return { label: 'Finalised', cls: styles.statusDone }
    if (lifecycles.includes('awaiting'))                  return { label: 'Awaiting landlord', cls: styles.statusWait }
    if (lifecycles.includes('sent'))                      return { label: 'Sent to agent', cls: styles.statusWait }
    if (lifecycles.includes('counter_prepared'))          return { label: 'Counter prepared', cls: '' }
    return { label: 'Reviewing', cls: '' }
  }

  const getDocSummary = (ws) => {
    const allDocs = (ws.negotiations || []).flatMap(n => n.documents || [])
    const hoaCount   = allDocs.filter(d => d.filename?.toLowerCase().includes('hoa')).length
    const leaseCount = allDocs.filter(d => !d.filename?.toLowerCase().includes('hoa')).length
    const parts = []
    if (leaseCount > 0) parts.push(`${leaseCount} lease${leaseCount > 1 ? 's' : ''}`)
    if (hoaCount > 0)   parts.push(`${hoaCount} HOA${hoaCount > 1 ? 's' : ''}`)
    if (parts.length === 0 && allDocs.length > 0)
      parts.push(`${allDocs.length} document${allDocs.length > 1 ? 's' : ''}`)
    return { summary: parts.join(' · ') || 'No documents', total: allDocs.length }
  }

  const getLatestDate = (ws) => {
    const docs = (ws.negotiations || []).flatMap(n => n.documents || [])
    if (!docs.length) return null
    return docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]?.uploaded_at
  }

  const totalDocs = workspaces.reduce((a, w) =>
    a + (w.negotiations || []).reduce((b, n) => b + (n.documents?.length || 0), 0), 0)

  const active = workspaces.filter(ws => {
    const negs = ws.negotiations || []
    if (negs.length === 0) return true
    return negs.some(n => n.lifecycle !== 'agreed')
  })
  const finalised = workspaces.filter(ws => {
    const negs = ws.negotiations || []
    return negs.length > 0 && negs.every(n => n.lifecycle === 'agreed')
  })

  // Sort by property name or tenant name
  const sortFn = (a, b) => {
    if (sortPref === 'tenant') {
      // Workspaces without client_name go to bottom
      if (!a.client_name && !b.client_name) return a.name.localeCompare(b.name)
      if (!a.client_name) return 1
      if (!b.client_name) return -1
      return a.client_name.toLowerCase().localeCompare(b.client_name.toLowerCase())
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  }

  const sortedActive    = [...active].sort(sortFn)
  const sortedFinalised = [...finalised].sort(sortFn)

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  const PropertyCard = ({ ws, fin = false }) => {
    const status             = getStatusChip(ws)
    const { summary, total } = getDocSummary(ws)
    const latestDate         = getLatestDate(ws)

    return (
      <div
        className={`${styles.wcard} ${fin ? styles.wcardFin : ''}`}
        onClick={() => navigate(`/workspace/${ws.id}`)}
      >
        <div className={styles.wcTop}>
          <div className={styles.wcBadge}>{ws.name[0]?.toUpperCase()}</div>
          <div className={styles.wcId}>
            <div className={styles.wcName}>{ws.name}</div>
            {ws.client_name && <div className={styles.wcTn}>{ws.client_name}</div>}
          </div>
          <span className={`${styles.statusChip} ${status.cls}`}>
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
            {latestDate
              ? `${fin ? 'Signed' : 'Updated'} ${formatDate(latestDate)}`
              : 'No activity'}
          </span>
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
            <h1 className={styles.h1}>Negotiations</h1>
            <div className={styles.summaryLine}>
              {active.length} in negotiation · {finalised.length} finalised · {totalDocs} document{totalDocs !== 1 ? 's' : ''} analysed
            </div>
          </div>
          <div className={styles.headActions}>
            <button className="btn-outline btn-sm" onClick={() => setWsModal(true)}>
              + New property
            </button>
            <button className="btn-ink btn-sm" onClick={() => navigate('/analyser')}>
              + Analyse document
            </button>
          </div>
        </div>

        {/* SORT TABS */}
        <div className={styles.sortTabs}>
          <button
            className={`${styles.sortTab} ${sortPref === 'property' ? styles.sortTabActive : ''}`}
            onClick={() => handleSortPref('property')}
          >
            By property
          </button>
          <button
            className={`${styles.sortTab} ${sortPref === 'tenant' ? styles.sortTabActive : ''}`}
            onClick={() => handleSortPref('tenant')}
          >
            By tenant
          </button>
        </div>

        {/* ACTIVE */}
        <div className={styles.dsec}>
          <div className={styles.sh}>
            <span className={styles.shLbl}>Active</span>
            <span className={styles.shCnt}>{active.length} in negotiation</span>
            <span className={styles.shLn} />
          </div>
          <div className={styles.wsGrid}>
            {sortedActive.map(ws => <PropertyCard key={ws.id} ws={ws} />)}
            <div
              className={`${styles.wcard} ${styles.wcardNew}`}
              onClick={() => setWsModal(true)}
            >
              <div className={styles.plus}>+</div>
              <div className={styles.nt}>New property</div>
              <div className={styles.ns}>Start a workspace for a new tenancy</div>
            </div>
          </div>
        </div>

        {/* FINALISED */}
        {sortedFinalised.length > 0 && (
          <div className={styles.dsec}>
            <div className={styles.sh}>
              <span className={styles.shLbl}>Finalised</span>
              <span className={styles.shCnt}>{sortedFinalised.length} signed</span>
              <span className={styles.shLn} />
            </div>
            <div className={styles.wsGrid}>
              {sortedFinalised.map(ws => <PropertyCard key={ws.id} ws={ws} fin />)}
            </div>
          </div>
        )}

        {/* UPGRADE BAR */}
        {(profile?.plan === 'free' || profile?.plan === 'one_off') && (
          <div className={styles.upgradeBar}>
            <div>
              <strong>Upgrade to Professional</strong>
              <span> — unlimited scans, branded PDFs, client workspaces and more.</span>
            </div>
            <button className="btn-primary btn-sm" onClick={() => navigate('/pricing')}>
              View plans →
            </button>
          </div>
        )}

      </div>

      {/* CREATE WORKSPACE MODAL */}
      {wsModal && (
        <div className={styles.overlay} onClick={() => setWsModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>New property</div>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label>Property name *</label>
                <input
                  className="input"
                  placeholder="e.g. Bondi Florist"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateWorkspace()}
                />
              </div>
              <div className={styles.field}>
                <label>
                  Tenant / client name{' '}
                  <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Sydney Flowers Pty Ltd"
                  value={wsClient}
                  onChange={e => setWsClient(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className="btn-ghost" onClick={() => setWsModal(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleCreateWorkspace}
                disabled={wsSaving || !wsName.trim()}
              >
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
