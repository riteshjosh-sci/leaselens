import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './Dashboard.module.css'

const CRITICAL_WINDOW_DAYS = 30

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [criticalCount, setCriticalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const { data: wsData } = await supabase
      .from('workspaces')
      .select(`
        id, name, client_name, created_at,
        negotiations (
          id, status, lifecycle, asset_class, property_name, created_at,
          documents ( id, filename, uploaded_at )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    const ws = wsData || []
    setWorkspaces(ws)

    // Critical dates: query lease_data for the most recent document of each negotiation
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

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const cleanName = (n) =>
    (n.property_name || 'Unnamed negotiation').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

  const allNegs = workspaces.flatMap(w =>
    (w.negotiations || []).map(n => ({ ...n, wsName: w.client_name || w.name }))
  )

  const totalDocs = allNegs.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const activeNegs = allNegs.filter(n => n.lifecycle !== 'agreed')
  const activeProperties = workspaces.filter(w => (w.negotiations || []).some(n => n.lifecycle !== 'agreed') || (w.negotiations || []).length === 0)

  const needsAttention = allNegs
    .filter(n => n.lifecycle === 'awaiting' || n.lifecycle === 'sent')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const recentNegs = [...allNegs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)

  const recentFinalised = allNegs
    .filter(n => n.lifecycle === 'agreed')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const assetMix = allNegs.reduce((acc, n) => {
    const key = n.asset_class || 'Unclassified'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const statusLabel = (lc) => ({
    awaiting: 'Awaiting landlord',
    sent: 'Sent to agent',
    counter_prepared: 'Counter prepared',
    agreed: 'Agreed',
  }[lc] || 'In review')

  if (loading) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  return (
    <AppSidebar>
      <div className={styles.page}>
        <h1 className={styles.h1}>Welcome back</h1>
        <div className={styles.summaryLine}>
          {activeProperties.length} properties · {activeNegs.length} active negotiations · {totalDocs} documents analysed
        </div>

        {/* STATS */}
        <div className={styles.statsGrid}>
          <div className={styles.statTile}>
            <div className={styles.statVal}>{activeProperties.length}</div>
            <div className={styles.statLbl}>Properties active</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statVal}>{activeNegs.length}</div>
            <div className={styles.statLbl}>Active negotiations</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statVal}>{totalDocs}</div>
            <div className={styles.statLbl}>Documents analysed</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.statVal}>{criticalCount}</div>
            <div className={styles.statLbl}>Critical dates ≤30d</div>
          </div>
        </div>

        <div className={styles.twoCol}>
          {/* NEEDS ATTENTION */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>Needs your attention</div>
            {needsAttention.length === 0 ? (
              <div className={styles.empty}>Nothing waiting on you right now.</div>
            ) : (
              <div className={styles.list}>
                {needsAttention.map(n => (
                  <div key={n.id} className={styles.row} onClick={() => navigate(`/negotiation/${n.id}`)}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowName}>{cleanName(n)}</div>
                      <div className={styles.rowSub}>{n.wsName}</div>
                    </div>
                    <span className={`${styles.chip} ${styles.chipWait}`}>{statusLabel(n.lifecycle)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ASSET MIX */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>Asset mix</div>
            {Object.keys(assetMix).length === 0 ? (
              <div className={styles.empty}>No negotiations yet.</div>
            ) : (
              <div className={styles.list}>
                {Object.entries(assetMix).map(([cls, count]) => (
                  <div key={cls} className={styles.mixRow}>
                    <span className={styles.mixLbl}>{cls}</span>
                    <span className={styles.mixVal}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT NEGOTIATIONS */}
        <div className={styles.dsec}>
          <div className={styles.sh}>
            <span className={styles.shLbl}>Negotiations</span>
            <span className={styles.shCnt}>{allNegs.length} total</span>
            <span className={styles.shLn} />
            <button className={styles.viewAll} onClick={() => navigate('/negotiations')}>View all →</button>
          </div>
          {recentNegs.length === 0 ? (
            <div className={styles.empty}>No negotiations yet. <button className={styles.linkBtn} onClick={() => navigate('/analyser')}>Analyse a document →</button></div>
          ) : (
            <div className={styles.list}>
              {recentNegs.map(n => (
                <div key={n.id} className={styles.row} onClick={() => navigate(`/negotiation/${n.id}`)}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{cleanName(n)}</div>
                    <div className={styles.rowSub}>{n.wsName}</div>
                  </div>
                  <span className={`${styles.chip} ${n.lifecycle === 'agreed' ? styles.chipDone : styles.chipWait}`}>{statusLabel(n.lifecycle)}</span>
                  <span className={styles.rowDate}>{formatDate(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FINALISED */}
        {recentFinalised.length > 0 && (
          <div className={styles.dsec}>
            <div className={styles.sh}>
              <span className={styles.shLbl}>Finalised</span>
              <span className={styles.shCnt}>{recentFinalised.length} shown</span>
              <span className={styles.shLn} />
            </div>
            <div className={styles.list}>
              {recentFinalised.map(n => (
                <div key={n.id} className={styles.row} onClick={() => navigate(`/negotiation/${n.id}`)}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{cleanName(n)}</div>
                    <div className={styles.rowSub}>{n.wsName}</div>
                  </div>
                  <span className={`${styles.chip} ${styles.chipDone}`}>Agreed</span>
                  <span className={styles.rowDate}>{formatDate(n.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppSidebar>
  )
}
