import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import Tour from '../components/Tour'
import styles from './Dashboard.module.css'

const TOUR_STEPS = [
  {
    title: 'Your portfolio at a glance',
    body: "This is Home — a quick read on what's active and what needs you today.",
  },
  {
    target: 'stats-strip',
    title: 'Headline numbers',
    body: 'Properties, active negotiations, and reports generated.',
  },
  {
    target: 'attention-panel',
    title: "Active negotiations",
    body: 'Anything still sitting un-reviewed since its last upload is flagged with ! and bumped to the top. Open "Properties" in the sidebar for the full grouped view.',
  },
]

// Checks counts are the number of legislation chunks the worker holds for
// each state/territory (see leaselens-worker/legislation.py STATE_META +
// LEGISLATION_CHUNKS) — real per-jurisdiction coverage, not per-document.
const JURISDICTION_GROUNDING = [
  { act: 'Retail Leases Act 1994 (NSW)', checks: 13 },
  { act: 'Retail Leases Act 2003 (VIC)', checks: 12 },
  { act: 'Retail Shop Leases Act 1994 (QLD)', checks: 11 },
  { act: 'Retail and Commercial Leases Act 1995 (SA)', checks: 12 },
  { act: 'Commercial Tenancy (Retail Shops) Agreements Act 1985 (WA)', checks: 8 },
  { act: 'Leases (Commercial and Retail) Act 2001 (ACT)', checks: 12 },
  { act: 'Business Tenancies (Fair Dealings) Act 2003 (NT)', checks: 12 },
  { act: 'Retail Tenancies Code 1998 (TAS)', checks: 8 },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [profile, setProfile] = useState(null)
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
      supabase.from('profiles').select('full_name, plan, free_scans_used, monthly_scans_used, scan_credits').eq('id', user.id).single(),
    ])

    const ws = wsRes.data || []
    setWorkspaces(ws)
    setProfile(profileRes.data)

    setLoading(false)
  }

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const cleanName = (n) =>
    (n.property_name || 'Unnamed negotiation').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

  const firstName = profile?.full_name?.split(' ')[0] || null

  const scanUsage = () => {
    const plan = profile?.plan || 'free'
    if (plan === 'free')    return { val: `${profile?.free_scans_used || 0} / 1`, unit: 'scan used' }
    if (plan === 'one_off') return { val: `${profile?.scan_credits || 0}`, unit: 'credits left' }
    if (plan === 'monthly' || plan === 'annual') return { val: `${profile?.monthly_scans_used || 0} / 10`, unit: 'this month' }
    if (plan === 'adviser') return { val: `${profile?.monthly_scans_used || 0} / ∞`, unit: 'this month' }
    return { val: '—', unit: '' }
  }

  const allNegs = workspaces.flatMap(w =>
    (w.negotiations || []).map(n => ({ ...n, wsName: w.client_name || w.name, wsId: w.id }))
  )

  const totalDocs = allNegs.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const activeNegs = allNegs.filter(n => n.lifecycle !== 'agreed')
  const activeWorkspaces = workspaces.filter(w =>
    (w.negotiations || []).some(n => n.lifecycle !== 'agreed') || (w.negotiations || []).length === 0
  )

  // A negotiation still needs review if it hasn't been marked as sent to the
  // landlord since its last document upload — see ReviewTab's "Mark as with
  // landlord for review" action and Analyser's merge-into-existing flow,
  // which resets this back to 'reviewing' when a new document lands.
  const needsReview = (n) => !n.lifecycle || n.lifecycle === 'reviewing'

  const activeNegsList = allNegs
    .filter(n => n.lifecycle !== 'agreed')
    .sort((a, b) => {
      const af = needsReview(a), bf = needsReview(b)
      if (af !== bf) return af ? -1 : 1
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const needsReviewCount = allNegs.filter(needsReview).length

  const finalisedNegs = allNegs
    .filter(n => n.lifecycle === 'agreed')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const statusInfo = (lc) => ({
    awaiting: { label: 'Awaiting landlord', cls: styles.chipWait },
    sent: { label: 'Sent to agent', cls: styles.chipWait },
    counter_prepared: { label: 'Counter prepared', cls: styles.chipCounter },
    agreed: { label: 'Finalised', cls: styles.chipDone },
  }[lc] || { label: 'Reviewing', cls: styles.chipNeutral })

  if (loading) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  return (
    <AppSidebar>
      <Tour steps={TOUR_STEPS} storageKey="ll_home_tour_seen" />
      <div className={styles.page}>

        {/* HEAD */}
        <div className={styles.head}>
          <div>
            <h1 className={styles.h1}>Welcome back{firstName ? `, ${firstName}` : ''}</h1>
            <div className={styles.summaryLine}>
              {activeWorkspaces.length} properties · {activeNegs.length} active negotiations
              {needsReviewCount > 0 && ` · ${needsReviewCount} need your review today.`}
            </div>
          </div>
          <button className="btn-ink btn-sm" onClick={() => navigate('/analyser')}>
            + Analyse new lease or HOA
          </button>
        </div>

        {/* STATS STRIP */}
        <div className={styles.statsStrip} data-tour="stats-strip">
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
            <div className={styles.statLbl}>Scans used</div>
            <div className={styles.statVal}>{scanUsage().val} <span>{scanUsage().unit}</span></div>
            {(!profile?.plan || profile.plan === 'free' || profile.plan === 'one_off') && (
              <button className={styles.statUpgrade} onClick={() => navigate('/pricing')}>Upgrade →</button>
            )}
          </div>
        </div>

        <div className={styles.twoCol}>
          {/* ACTIVE NEGOTIATIONS */}
          <div className={styles.panel} data-tour="attention-panel">
            <div className={styles.panelHead}>
              <span className={styles.panelBar} />
              <span className={styles.panelTitle}>Active negotiations</span>
              <span className={styles.panelCount}>{activeNegsList.length} items</span>
            </div>
            <div className={styles.panelBody}>
              {activeNegsList.length === 0 ? (
                <div className={styles.empty}>Nothing active right now.</div>
              ) : (
                activeNegsList.map(n => {
                  const info = statusInfo(n.lifecycle)
                  return (
                    <div key={n.id} className={styles.attnRow} onClick={() => navigate(`/negotiation/${n.id}`)}>
                      <span className={`${styles.attnBadge} ${info.cls}`}>{info.label}</span>
                      <div className={styles.attnMain}>
                        <div className={styles.attnName}>
                          {needsReview(n) && <span className={styles.attnFlag} title="Needs review">!</span>}
                          {cleanName(n)}
                        </div>
                        <div className={styles.attnSub}>{n.wsName}</div>
                      </div>
                      <span className={styles.attnOpen}>Open →</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* JURISDICTION GROUNDING — see comment above JURISDICTION_GROUNDING */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelBar} />
              <span className={styles.panelTitle}>Jurisdiction grounding</span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.jurisSub}>Every clause checked against the legislation that applies.</div>
              {JURISDICTION_GROUNDING.map(j => (
                <div key={j.act} className={styles.jurisRow}>
                  <span className={styles.jurisAct}>{j.act}</span>
                  <span className={styles.jurisChecks}>{j.checks} checks</span>
                </div>
              ))}
            </div>
          </div>
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
