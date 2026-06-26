import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import Tour from '../components/Tour'
import styles from './Properties.module.css'

const TOUR_STEPS = [
  {
    title: 'Welcome to LeaseRoom',
    body: "Here's a 30-second tour of how to get the most out of it.",
  },
  {
    target: 'analyse-btn',
    title: 'Analyse a document',
    body: 'Upload a Heads of Agreement or Lease and get a full clause-by-clause risk analysis in under 2 minutes.',
  },
  {
    target: 'new-property-btn',
    title: 'Properties keep things organised',
    body: 'Each property gets its own workspace — every HOA, lease version, and review note lives together in one place.',
  },
  {
    target: 'sort-tabs',
    title: 'Sort your list',
    body: 'Switch between sorting your properties by property name or by tenant name.',
  },
]

export default function Properties() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
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
            id, status, lifecycle, tenant_name, premises_address, created_at,
            documents (
              id, filename, uploaded_at, overall_risk
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('sort_preference').eq('id', user.id).single(),
    ])
    setWorkspaces(wsRes.data || [])
    if (profileRes.data?.sort_preference) setSortPref(profileRes.data.sort_preference)
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

  const cleanName = (n) =>
    (n.property_name || n.tenant_name || 'Unnamed negotiation').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

  const getDocSummary = (n) => {
    const docs = n.documents || []
    const hoaCount   = docs.filter(d => d.filename?.toLowerCase().includes('hoa')).length
    const leaseCount = docs.filter(d => !d.filename?.toLowerCase().includes('hoa')).length
    const parts = []
    if (leaseCount > 0) parts.push(`${leaseCount} lease${leaseCount > 1 ? 's' : ''}`)
    if (hoaCount > 0)   parts.push(`${hoaCount} HOA${hoaCount > 1 ? 's' : ''}`)
    if (parts.length === 0 && docs.length > 0) parts.push(`${docs.length} document${docs.length > 1 ? 's' : ''}`)
    return parts.join(' · ') || 'No documents'
  }

  const getNegStatus = (n) => {
    if (n.lifecycle === 'agreed')           return { label: 'Finalised', cls: styles.chipDone }
    if (n.lifecycle === 'awaiting')         return { label: 'Awaiting landlord', cls: styles.chipWait }
    if (n.lifecycle === 'sent')              return { label: 'Sent to agent', cls: styles.chipWait }
    if (n.lifecycle === 'counter_prepared') return { label: 'Counter prepared', cls: styles.chipNeutral }
    if (!(n.documents || []).length)        return { label: 'No documents', cls: styles.chipNeutral }
    return { label: 'Reviewing', cls: styles.chipNeutral }
  }

  // Sanity-check extracted values — reject anything that looks like clause text
  const CLAUSE_WORDS = ['takes a lease', 'landlord', 'herein', 'pursuant', 'thereof', 'together with', 'non-exclusive', 'the term']
  const isClauseText = v => !v || v.length > 150 || CLAUSE_WORDS.some(w => v.toLowerCase().includes(w))

  const wsDisplay = (ws) => {
    const negs = ws.negotiations || []
    const negWithData = negs.find(n => n.tenant_name || n.premises_address)
    const extractedTenant  = !isClauseText(negWithData?.tenant_name)  ? negWithData.tenant_name  : null
    const extractedAddress = !isClauseText(negWithData?.premises_address) ? negWithData.premises_address : null
    const displayName    = extractedTenant  || ws.client_name || ws.name
    const displayAddress = extractedAddress
      || (extractedTenant  && ws.name)
      || (ws.client_name   && ws.name)
      || null
    return { displayName, displayAddress }
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

  const sortFn = (a, b) => {
    if (sortPref === 'tenant') {
      if (!a.client_name && !b.client_name) return a.name.localeCompare(b.name)
      if (!a.client_name) return 1
      if (!b.client_name) return -1
      return a.client_name.toLowerCase().localeCompare(b.client_name.toLowerCase())
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  }

  const sortedActive    = [...active].sort(sortFn)
  const sortedFinalised = [...finalised].sort(sortFn)

  if (loading) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  const WorkspaceGroup = ({ ws }) => {
    const { displayName, displayAddress } = wsDisplay(ws)
    const negs = ws.negotiations || []
    return (
      <div className={styles.wsGroup}>
        <div className={styles.wsGroupHead} onClick={() => navigate(`/workspace/${ws.id}`)}>
          <div className={styles.wsBadge}>{displayName[0]?.toUpperCase()}</div>
          <div className={styles.wsGroupId}>
            <div className={styles.wsGroupName}>{displayName}</div>
            {displayAddress && <div className={styles.wsGroupAddr}>{displayAddress}</div>}
          </div>
          <span className={styles.wsGroupOpen}>Open →</span>
        </div>
        {negs.length === 0 ? (
          <div className={styles.negRow} style={{ cursor: 'default' }}>
            <div className={styles.negMain}>
              <div className={styles.negMeta}>No negotiations yet</div>
            </div>
          </div>
        ) : (
          negs.map(n => {
            const status = getNegStatus(n)
            return (
              <div key={n.id} className={styles.negRow} onClick={() => navigate(`/negotiation/${n.id}`)}>
                <div className={styles.negMain}>
                  <div className={styles.negName}>{cleanName(n)}</div>
                  <div className={styles.negMeta}>{getDocSummary(n)}</div>
                </div>
                <div className={styles.negRight}>
                  <span className={`${styles.chip} ${status.cls}`}><span className={styles.chipDot} />{status.label}</span>
                  <span className={styles.negDate}>{formatDate(n.created_at)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <AppSidebar>
      <Tour steps={TOUR_STEPS} storageKey="ll_dashboard_tour_seen" />
      <div className={styles.page}>

        {/* HEAD */}
        <div className={styles.head}>
          <div>
            <h1 className={styles.h1}>Properties</h1>
            <div className={styles.summaryLine}>
              {workspaces.length} propert{workspaces.length !== 1 ? 'ies' : 'y'} · each a site, its tenant and its negotiations.
            </div>
          </div>
          <button className="btn-outline btn-sm" data-tour="new-property-btn" onClick={() => setWsModal(true)}>
            + New property
          </button>
        </div>

        {/* SORT TOGGLE */}
        <div className={styles.sortRow} data-tour="sort-tabs">
          <button
            className={sortPref === 'property' ? styles.sortActive : ''}
            onClick={() => handleSortPref('property')}
          >
            By property
          </button>
          <span className={styles.sortDiv}>·</span>
          <button
            className={sortPref === 'tenant' ? styles.sortActive : ''}
            onClick={() => handleSortPref('tenant')}
          >
            By tenant
          </button>
        </div>

        {/* ACTIVE */}
        <div className={styles.dsec}>
          <div className={styles.sh}>
            <span className={styles.panelBar} />
            <span className={styles.shLbl}>Active</span>
            <span className={styles.shCnt}>{active.length} in negotiation</span>
          </div>
          {sortedActive.map(ws => <WorkspaceGroup key={ws.id} ws={ws} />)}
        </div>

        {/* FINALISED */}
        {sortedFinalised.length > 0 && (
          <div className={styles.dsec}>
            <div className={styles.sh}>
              <span className={styles.panelBar} />
              <span className={styles.shLbl}>Finalised</span>
              <span className={styles.shCnt}>{sortedFinalised.length} signed</span>
            </div>
            {sortedFinalised.map(ws => <WorkspaceGroup key={ws.id} ws={ws} />)}
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
    </AppSidebar>
  )
}
