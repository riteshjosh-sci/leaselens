import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './Dashboard.module.css'

const CRITICAL_WINDOW_DAYS = 30

// Dummy placeholder until Adam confirms real per-jurisdiction check counts —
// not derived from any data source, swap out before this ships to real users.
const JURISDICTION_GROUNDING_DUMMY = [
  { act: 'Retail Leases Act 2003 (VIC)', checks: 31 },
  { act: 'Commercial Tenancy Act (WA)', checks: 31 },
  { act: 'Retail Leases Act 1994 (NSW)', checks: 28 },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [profile, setProfile] = useState(null)
  const [criticalCount, setCriticalCount] = useState(0)
  const [sortPref, setSortPref] = useState('property') // 'property' | 'tenant'
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const [wsRes, profileRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select(`
          id, name, client_name, created_at,
          negotiations (
            id, status, lifecycle, asset_class, property_name, tenant_name, premises_address, created_at,
            documents ( id, filename, uploaded_at )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('full_name, sort_preference').eq('id', user.id).single(),
    ])

    const ws = wsRes.data || []
    setWorkspaces(ws)
    setProfile(profileRes.data)
    if (profileRes.data?.sort_preference) setSortPref(profileRes.data.sort_preference)

    const allDocIds = ws.flatMap(w => (w.negotiations || []).flatMap(n => (n.documents || []).map(d => d.id)))
    if (allDocIds.length) {
      const { data: leaseRows } = await supabase
        .from('lease_data')
        .select('document_id, expiry_date')
        .in('document_id', allDocIds)
      const now = new Date()
      const cutoff = new Date(now.getTime() + CRITICAL_WINDOW_DAYS * 86400000)
      const upcoming = (leaseRows || []).filter(r => {
        if (!r.expiry_date) return false
        const d = new Date(r.expiry_date)
        return d >= now && d <= cutoff
      })
      setCriticalCount(upcoming.length)
    }

    setLoading(false)
  }

  const handleSortPref = async (pref) => {
    setSortPref(pref)
    await supabase.from('profiles').update({ sort_preference: pref }).eq('id', user.id)
  }

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const cleanName = (n) =>
    (n.property_name || 'Unnamed negotiation').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

  const firstName = profile?.full_name?.split(' ')[0] || null

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

  // Sanity-check extracted values — same guard Properties.jsx uses to avoid showing clause text
  const CLAUSE_WORDS = ['takes a lease', 'landlord', 'herein', 'pursuant', 'thereof', 'together with', 'non-exclusive', 'the term']
  const isClauseText = v => !v || v.length > 150 || CLAUSE_WORDS.some(w => v.toLowerCase().includes(w))

  const wsDisplay = (ws) => {
    const negs = ws.negotiations || []
    const negWithData = negs.find(n => n.tenant_name || n.premises_address)
    const extractedTenant = !isClauseText(negWithData?.tenant_name) ? negWithData.tenant_name : null
    const extractedAddress = !isClauseText(negWithData?.premises_address) ? negWithData.premises_address : null
    const displayName = extractedTenant || ws.client_name || ws.name
    const displayAddress = extractedAddress || (extractedTenant && ws.name) || (ws.client_name && ws.name) || null
    return { displayName, displayAddress }
  }

  const allNegs = workspaces.flatMap(w =>
    (w.negotiations || []).map(n => ({ ...n, wsName: w.client_name || w.name, wsId: w.id }))
  )

  const totalDocs = allNegs.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const activeNegs = allNegs.filter(n => n.lifecycle !== 'agreed')
  const activeWorkspaces = workspaces.filter(w =>
    (w.negotiations || []).some(n => n.lifecycle !== 'agreed') || (w.negotiations || []).length === 0
  )

  const needsAttention = allNegs
    .filter(n => n.lifecycle === 'awaiting' || n.lifecycle === 'sent' || n.lifecycle === 'counter_prepared')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const finalisedNegs = allNegs
    .filter(n => n.lifecycle === 'agreed')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const sortFn = (a, b) => {
    if (sortPref === 'tenant') {
      const an = a.client_name, bn = b.client_name
      if (!an && !bn) return a.name.localeCompare(b.name)
      if (!an) return 1
      if (!bn) return -1
      return an.toLowerCase().localeCompare(bn.toLowerCase())
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  }

  const groupedWorkspaces = [...activeWorkspaces]
    .filter(w => (w.negotiations || []).length > 0)
    .sort(sortFn)

  const statusInfo = (lc) => ({
    awaiting: { label: 'Awaiting landlord', cls: styles.chipWait },
    sent: { label: 'Sent to agent', cls: styles.chipWait },
    counter_prepared: { label: 'Counter prepared', cls: styles.chipCounter },
    agreed: { label: 'Finalised', cls: styles.chipDone },
  }[lc] || { label: 'Reviewing', cls: styles.chipNeutral })

  if (loading) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  return (
    <AppSidebar>
      <div className={styles.page}>

        {/* HEAD */}
        <div className={styles.head}>
          <div>
            <h1 className={styles.h1}>Welcome back{firstName ? `, ${firstName}` : ''}</h1>
            <div className={styles.summaryLine}>
              {activeWorkspaces.length} properties · {activeNegs.length} active negotiations
              {needsAttention.length > 0 && ` · ${needsAttention.length} need your attention today.`}
            </div>
          </div>
          <button className="btn-ink btn-sm" onClick={() => navigate('/analyser')}>
            + Analyse new lease or HOA
          </button>
        </div>

        {/* STATS STRIP */}
        <div className={styles.statsStrip}>
          <div className={styles.statCell}>
            <div className={styles.statLbl}>Properties</div>
            <div className={styles.statVal}>{activeWorkspaces.length} <span>active</span></div>
          </div>
          <div className={styles.statCell}>
            <div className={styles.statLbl}>Active negotiations</div>
            <div className={styles.statVal}>{activeNegs.length} <span>in progress</span></div>
          </div>
          <div className={styles.statCell}>
            <div className={styles.statLbl}>Reports generated</div>
            <div className={styles.statVal}>{totalDocs} <span>all-time</span></div>
          </div>
          <div className={styles.statCell}>
            <div className={styles.statLbl}>Critical dates ≤30d</div>
            <div className={styles.statVal}>{criticalCount} <span>due soon</span></div>
          </div>
        </div>

        <div className={styles.twoCol}>
          {/* NEEDS ATTENTION */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelBar} />
              <span className={styles.panelTitle}>Needs your attention</span>
              <span className={styles.panelCount}>{needsAttention.length} items</span>
            </div>
            <div className={styles.panelBody}>
              {needsAttention.length === 0 ? (
                <div className={styles.empty}>Nothing waiting on you right now.</div>
              ) : (
                needsAttention.map(n => {
                  const info = statusInfo(n.lifecycle)
                  return (
                    <div key={n.id} className={styles.attnRow} onClick={() => navigate(`/negotiation/${n.id}`)}>
                      <span className={`${styles.attnBadge} ${info.cls}`}>{info.label}</span>
                      <div className={styles.attnMain}>
                        <div className={styles.attnName}>{cleanName(n)}</div>
                        <div className={styles.attnSub}>{n.wsName}</div>
                      </div>
                      <span className={styles.attnOpen}>Open →</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* JURISDICTION GROUNDING — dummy data, see comment above JURISDICTION_GROUNDING_DUMMY */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelBar} />
              <span className={styles.panelTitle}>Jurisdiction grounding</span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.jurisSub}>Every clause checked against the legislation that applies.</div>
              {JURISDICTION_GROUNDING_DUMMY.map(j => (
                <div key={j.act} className={styles.jurisRow}>
                  <span className={styles.jurisAct}>{j.act}</span>
                  <span className={styles.jurisChecks}>{j.checks} checks</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NEGOTIATIONS — grouped by property */}
        <div className={styles.dsec}>
          <div className={styles.sh}>
            <span className={styles.panelBar} />
            <span className={styles.shLbl}>Negotiations</span>
            <span className={styles.sortToggle}>
              <button className={sortPref === 'property' ? styles.sortActive : ''} onClick={() => handleSortPref('property')}>By property</button>
              <span className={styles.sortDiv}>·</span>
              <button className={sortPref === 'tenant' ? styles.sortActive : ''} onClick={() => handleSortPref('tenant')}>By tenant</button>
            </span>
          </div>

          {groupedWorkspaces.length === 0 ? (
            <div className={styles.empty}>No negotiations yet. <button className={styles.linkBtn} onClick={() => navigate('/analyser')}>Analyse a document →</button></div>
          ) : (
            groupedWorkspaces.map(ws => {
              const { displayName, displayAddress } = wsDisplay(ws)
              const negs = ws.negotiations || []
              return (
                <div key={ws.id} className={styles.wsGroup}>
                  <div className={styles.wsGroupHead} onClick={() => navigate(`/workspace/${ws.id}`)}>
                    <div className={styles.wsBadge}>{displayName[0]?.toUpperCase()}</div>
                    <div className={styles.wsGroupId}>
                      <div className={styles.wsGroupName}>{displayName}</div>
                      {displayAddress && <div className={styles.wsGroupAddr}>{displayAddress}</div>}
                    </div>
                    <span className={styles.wsGroupOpen}>Open →</span>
                  </div>
                  {negs.map(n => {
                    const info = statusInfo(n.lifecycle)
                    return (
                      <div key={n.id} className={styles.negRow} onClick={() => navigate(`/negotiation/${n.id}`)}>
                        <div className={styles.negMain}>
                          <div className={styles.negName}>{cleanName(n)}</div>
                          <div className={styles.negMeta}>{getDocSummary(n)}</div>
                        </div>
                        <div className={styles.negRight}>
                          <span className={`${styles.chip} ${info.cls}`}><span className={styles.chipDot} />{info.label}</span>
                          <span className={styles.negDate}>{formatDate(n.created_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* FINALISED */}
        {finalisedNegs.length > 0 && (
          <div className={styles.dsec}>
            <div className={styles.sh}>
              <span className={styles.panelBar} />
              <span className={styles.shLbl}>Finalised</span>
            </div>
            <div className={styles.list}>
              {finalisedNegs.map(n => (
                <div key={n.id} className={styles.negRow} onClick={() => navigate(`/negotiation/${n.id}`)}>
                  <div className={styles.negMain}>
                    <div className={styles.wsBadge}>{n.wsName[0]?.toUpperCase()}</div>
                    <div>
                      <div className={styles.negName}>{n.wsName}</div>
                      <div className={styles.negMeta}>{cleanName(n)}</div>
                    </div>
                  </div>
                  <div className={styles.negRight}>
                    <span className={`${styles.chip} ${styles.chipDone}`}><span className={styles.chipDot} />Finalised</span>
                    <span className={styles.negDate}>{formatDate(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppSidebar>
  )
}
