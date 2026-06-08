import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Dashboard.module.css'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces]   = useState([])
  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [wsModal, setWsModal]         = useState(false)
  const [wsName, setWsName]           = useState('')
  const [wsClient, setWsClient]       = useState('')
  const [wsSaving, setWsSaving]       = useState(false)

  // derived analytics
  const [stats, setStats]             = useState(null)
  const [monthlyData, setMonthlyData] = useState([])
  const [recentReports, setRecentReports] = useState([])

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const [wsRes, profileRes, reportsRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select(`
          id, name, client_name, logo_path, created_at,
          negotiations (
            id,
            documents (
              id, uploaded_at, overall_risk,
              reports ( id, created_at )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('reports')
        .select(`
          id, created_at,
          documents (
            id, filename, overall_risk, uploaded_at,
            negotiations ( id, property_name, workspace_id )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const ws = wsRes.data || []
    const prof = profileRes.data
    const recent = reportsRes.data || []

    setWorkspaces(ws)
    setProfile(prof)
    setRecentReports(recent)

    // Compute stats
    const allDocs = ws.flatMap(w => w.negotiations.flatMap(n => n.documents))
    const high   = allDocs.filter(d => d.overall_risk === 'HIGH').length
    const medium = allDocs.filter(d => d.overall_risk === 'MEDIUM').length
    const low    = allDocs.filter(d => d.overall_risk === 'LOW').length

    // Monthly docs — last 6 months
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('en-AU', { month: 'short' })
      const count = allDocs.filter(doc => {
        const rd = new Date(doc.uploaded_at)
        return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear()
      }).length
      months.push({ label, count })
    }

    setStats({
      totalDocs: allDocs.length,
      totalWorkspaces: ws.length,
      highRisk: high,
      scansUsed: prof?.free_scans_used || prof?.monthly_scans_used || 0,
      scansLimit: prof?.plan === 'professional' ? '∞' : prof?.plan === 'one_off' ? prof?.scan_credits || 0 : prof?.plan === 'free' ? 1 : 10,
      high, medium, low,
    })
    setMonthlyData(months)
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
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const riskClass = { HIGH: 'badge badge-high', MEDIUM: 'badge badge-medium', LOW: 'badge badge-low' }

  const RISK_COLORS = {
    HIGH: '#8b2020',
    MEDIUM: '#b8975a',
    LOW: '#1a5c30',
  }

  const donutData = stats ? [
    { name: 'High', value: stats.high,   color: RISK_COLORS.HIGH },
    { name: 'Medium', value: stats.medium, color: RISK_COLORS.MEDIUM },
    { name: 'Low', value: stats.low,    color: RISK_COLORS.LOW },
  ].filter(d => d.value > 0) : []

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) return (
      <div style={{ background: '#0f0f0d', color: 'white', padding: '8px 12px', borderRadius: 2, fontSize: 12 }}>
        <div style={{ color: '#b8975a', marginBottom: 2 }}>{label}</div>
        <div>{payload[0].value} document{payload[0].value !== 1 ? 's' : ''}</div>
      </div>
    )
    return null
  }

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
            <button className={styles.newWsBtn} onClick={() => setWsModal(true)}>+ New workspace</button>
            <button className="btn-primary" onClick={() => navigate('/analyser')}>+ Analyse document</button>
          </div>
        </div>

        {/* STATS ROW */}
        {stats && (
          <div className={styles.statsRow}>
            {[
              {
                label: 'Documents analysed',
                value: stats.totalDocs,
                sub: 'all time',
                color: 'var(--accent-mid)',
              },
              {
                label: 'High risk documents',
                value: stats.highRisk,
                sub: 'require attention',
                color: 'var(--risk-h)',
                bg: stats.highRisk > 0 ? 'var(--risk-h-bg)' : undefined,
              },
              {
                label: 'Active workspaces',
                value: stats.totalWorkspaces,
                sub: 'client portfolios',
                color: 'var(--gold)',
              },
              {
                label: profile?.plan === 'professional' ? 'Plan' : 'Scans used',
                value: profile?.plan === 'professional' ? '∞' : `${stats.scansUsed}/${stats.scansLimit}`,
                sub: profile?.plan || 'free plan',
                color: 'var(--ink)',
                isText: profile?.plan === 'professional',
              },
            ].map((s, i) => (
              <div key={i} className={styles.statCard} style={{ background: s.bg }}>
                <div className={styles.statValue} style={{ color: s.color, fontSize: s.isText ? 28 : undefined }}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statSub}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* CHARTS + RECENT ROW */}
        {stats && stats.totalDocs > 0 && (
          <div className={styles.chartsRow}>

            {/* Monthly bar chart */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>Documents uploaded</div>
                <div className={styles.chartSub}>Last 6 months</div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={monthlyData} barSize={20} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ink-light)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--ink-light)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="count" fill="var(--accent-mid)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Risk donut */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>Risk distribution</div>
                <div className={styles.chartSub}>{stats.totalDocs} documents</div>
              </div>
              <div className={styles.donutWrap}>
                <PieChart width={120} height={120}>
                  <Pie data={donutData} cx={55} cy={55} innerRadius={36} outerRadius={52}
                    dataKey="value" startAngle={90} endAngle={-270}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(val, name) => [val, name]} contentStyle={{ fontSize: 12, background: '#0f0f0d', border: 'none', color: 'white', borderRadius: 2 }} />
                </PieChart>
                <div className={styles.donutLegend}>
                  {[
                    { label: 'High risk',   value: stats.high,   color: RISK_COLORS.HIGH },
                    { label: 'Medium risk', value: stats.medium, color: RISK_COLORS.MEDIUM },
                    { label: 'Low risk',    value: stats.low,    color: RISK_COLORS.LOW },
                  ].map(l => (
                    <div key={l.label} className={styles.legendRow}>
                      <span className={styles.legendDot} style={{ background: l.color }} />
                      <span className={styles.legendLabel}>{l.label}</span>
                      <span className={styles.legendVal}>{l.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent reports */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>Recent reports</div>
              </div>
              <div className={styles.recentList}>
                {recentReports.length === 0 ? (
                  <div className={styles.recentEmpty}>No reports yet.</div>
                ) : recentReports.map(r => (
                  <div key={r.id} className={styles.recentRow} onClick={() => navigate(`/report/${r.id}`)}>
                    <div className={styles.recentInfo}>
                      <div className={styles.recentName}>
                        {r.documents?.negotiations?.property_name || stripTimestamp(r.documents?.filename)}
                      </div>
                      <div className={styles.recentDate}>{formatDate(r.created_at)}</div>
                    </div>
                    {r.documents?.overall_risk && (
                      <span className={riskClass[r.documents.overall_risk]} style={{ fontSize: 10 }}>
                        {r.documents.overall_risk}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACES GRID */}
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Workspaces</div>
          <button className={styles.newWsLink} onClick={() => setWsModal(true)}>+ New workspace</button>
        </div>

        <div className={styles.wsGrid}>
          {workspaces.map(ws => {
            const allDocs = ws.negotiations.flatMap(n => n.documents)
            const negCount = ws.negotiations.length
            const docCount = allDocs.length
            const highCount = allDocs.filter(d => d.overall_risk === 'HIGH').length
            const latestDoc = allDocs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]
            const logoUrl = ws.logo_path
              ? supabase.storage.from('logos').getPublicUrl(ws.logo_path).data?.publicUrl
              : null

            return (
              <div key={ws.id} className={styles.wsCard} onClick={() => navigate(`/workspace/${ws.id}/settings`)}>
                <div className={styles.wsCardTop}>
                  {logoUrl
                    ? <img src={logoUrl} alt="logo" className={styles.wsCardLogo} />
                    : <div className={styles.wsCardInitial}>{ws.name[0]?.toUpperCase()}</div>
                  }
                  <div className={styles.wsCardMeta}>
                    <div className={styles.wsCardName}>{ws.name}</div>
                    {ws.client_name && <div className={styles.wsCardClient}>{ws.client_name}</div>}
                  </div>
                  {highCount > 0 && (
                    <span className="badge badge-high" style={{ fontSize: 10, marginLeft: 'auto' }}>
                      {highCount} HIGH
                    </span>
                  )}
                </div>
                <div className={styles.wsCardStats}>
                  <div className={styles.wsCardStat}>
                    <span className={styles.wsCardStatVal}>{negCount}</span>
                    <span className={styles.wsCardStatLabel}>negotiation{negCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.wsCardDivider} />
                  <div className={styles.wsCardStat}>
                    <span className={styles.wsCardStatVal}>{docCount}</span>
                    <span className={styles.wsCardStatLabel}>document{docCount !== 1 ? 's' : ''}</span>
                  </div>
                  {latestDoc && (
                    <>
                      <div className={styles.wsCardDivider} />
                      <div className={styles.wsCardStat}>
                        <span className={styles.wsCardStatLabel}>Last upload</span>
                        <span className={styles.wsCardStatVal} style={{ fontSize: 11 }}>{formatDate(latestDoc.uploaded_at)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className={styles.wsCardFooter}>
                  Open workspace →
                </div>
              </div>
            )
          })}

          {/* New workspace card */}
          <div className={`${styles.wsCard} ${styles.wsCardNew}`} onClick={() => setWsModal(true)}>
            <div className={styles.wsCardNewIcon}>+</div>
            <div className={styles.wsCardNewLabel}>New workspace</div>
            <div className={styles.wsCardNewSub}>Create a client or portfolio workspace</div>
          </div>
        </div>

        {/* UPGRADE NUDGE */}
        {(profile?.plan === 'free' || profile?.plan === 'one_off') && (
          <div className={styles.upgradeBar}>
            <div>
              <strong>Upgrade to Professional</strong>
              <span> — unlimited scans, branded PDFs, client workspaces, and more.</span>
            </div>
            <button className="btn-primary" onClick={() => navigate('/pricing')}>View plans →</button>
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
                <input className="input" placeholder="e.g. Collins Street Portfolio" value={wsName}
                  onChange={e => setWsName(e.target.value)} autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateWorkspace()} />
              </div>
              <div className={styles.field}>
                <label>Client name <span style={{ fontWeight: 300, color: 'var(--ink-light)' }}>(optional)</span></label>
                <input className="input" placeholder="e.g. Acme Retail Pty Ltd" value={wsClient}
                  onChange={e => setWsClient(e.target.value)} />
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
