import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AdminNav from '../components/AdminNav'
import styles from './Admin.module.css'
import {
  AreaChart, Area, BarChart as RBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

async function adminFetch(resource, token) {
  const res = await fetch(`/api/admin-data?resource=${resource}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function adminAction(action, payload, token) {
  const res = await fetch('/api/admin-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const PLANS = ['free', 'one_off', 'monthly', 'annual', 'adviser']

function Counter({ value, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const end = parseInt(value) || 0
    if (start === end) { setDisplay(end); return }
    const duration = 1200
    const step = Math.ceil(duration / end) || 16
    const timer = setInterval(() => {
      start += Math.ceil(end / 60)
      if (start >= end) { setDisplay(end); clearInterval(timer) }
      else setDisplay(start)
    }, step)
    return () => clearInterval(timer)
  }, [value])
  return <span>{prefix}{display.toLocaleString()}{suffix}</span>
}

function Sparkline({ data, color }) {
  const chartData = (data || []).map(d => ({ name: d.label, value: d.count }))
  return (
    <ResponsiveContainer width={120} height={48}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace(/[^a-z]/gi,'')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          fill={`url(#grad-${color.replace(/[^a-z]/gi,'')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function BarChartComp({ data, color }) {
  const chartData = (data || []).map(d => ({ name: d.label, value: d.count }))
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) return (
      <div style={{ background: 'var(--ink)', color: 'white', padding: '8px 12px', borderRadius: 2, fontSize: 12 }}>
        <div style={{ color: 'var(--accent)', marginBottom: 2 }}>{label}</div>
        <div>{payload[0].value}</div>
      </div>
    )
    return null
  }
  return (
    <ResponsiveContainer width="100%" height={120}>
      <RBarChart data={chartData} barSize={24} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-light)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--ink-light)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
      </RBarChart>
    </ResponsiveContainer>
  )
}

function Donut({ segments }) {
  const data = segments.filter(s => s.value > 0).map(s => ({ value: s.value, color: s.color, label: s.label }))
  const total = segments.reduce((a, s) => a + s.value, 0)
  const CustomLabel = ({ cx, cy }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily="DM Serif Display" fontSize="20" fill="var(--ink)">{total}</text>
  )
  if (!data.length) return <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12 }}>No data</div>
  return (
    <PieChart width={120} height={120}>
      <Pie data={data} cx={55} cy={55} innerRadius={36} outerRadius={52} dataKey="value" labelLine={false} label={<CustomLabel />} startAngle={90} endAngle={-270}>
        {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
      </Pie>
      <Tooltip formatter={(val, name, props) => [val, props.payload.label || '']} contentStyle={{ fontSize: 12, background: 'var(--ink)', border: 'none', color: 'white', borderRadius: 2 }} />
    </PieChart>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [documents, setDocuments] = useState([])
  const [reports, setReports] = useState([])
  const [betaCodes, setBetaCodes] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [newCode, setNewCode] = useState('')

  useEffect(() => {
    if (!user) { navigate('/admin/login'); return }
    if (user.email !== ADMIN_EMAIL) { navigate('/'); return }
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setLoading(false); return }

    const [profiles, docs, reportsData, codes, waitlistData] = await Promise.all([
      adminFetch('profiles', token),
      adminFetch('documents', token),
      adminFetch('reports', token),
      adminFetch('beta_codes', token),
      adminFetch('waitlist', token),
    ])

    const u = profiles || []
    const d = docs || []
    const r = reportsData || []
    const c = codes || []
    const w = waitlistData || []

    // Fetch workspaces directly (no sensitive data, just structure)
    const wsRaw = await adminFetch('workspaces', token)
    const wsData = wsRaw || []

    const ws = wsData || []

    // Enrich workspaces with owner email from profiles
    const wsEnriched = ws.map(w => ({
      ...w,
      ownerEmail: u.find(p => p.id === w.user_id)?.email || '—',
      negCount: w.negotiations?.length || 0,
    }))

    const riskCounts = d.reduce((acc, doc) => { acc[doc.overall_risk] = (acc[doc.overall_risk] || 0) + 1; return acc }, {})
    const planCounts = PLANS.reduce((acc, p) => { acc[p] = u.filter(x => x.plan === p).length; return acc }, {})
    const paidUsers = u.filter(x => ['one_off','monthly','annual','adviser'].includes(x.plan))
    const mrr = u.filter(x => x.plan === 'monthly').length * 99
      + u.filter(x => x.plan === 'annual').length * (99 * 0.8)
      + u.filter(x => x.plan === 'adviser').length * 299

    setStats({
      totalUsers: u.length,
      totalDocs: d.length,
      totalReports: r.length,
      paidUsers: paidUsers.length,
      mrr: Math.round(mrr),
      highRisk: riskCounts['HIGH'] || 0,
      medRisk: riskCounts['MEDIUM'] || 0,
      lowRisk: riskCounts['LOW'] || 0,
      planCounts,
      monthlySignups: buildMonthly(u, 'created_at'),
      monthlyDocs: buildMonthly(d, 'uploaded_at'),
      betaUsed: c.filter(x => x.used).length,
      betaTotal: c.length,
      waitlistCount: w.length,
      totalWorkspaces: ws.length,
    })
    setUsers(u)
    setDocuments(d)
    setReports(r)
    setBetaCodes(c)
    setWaitlist(w)
    setWorkspaces(wsEnriched)
    setLoading(false)
  }

  const buildMonthly = (rows, field) => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('en-AU', { month: 'short' })
      const count = rows.filter(r => {
        const rd = new Date(r[field])
        return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear()
      }).length
      months.push({ label, count })
    }
    return months
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const riskBadge = (risk) => {
    if (!risk) return <span className="badge badge-medium">—</span>
    const map = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' }
    return <span className={`badge ${map[risk]}`}>{risk}</span>
  }

  const planBadge = (plan) => {
    const map = { free: styles.planFree, one_off: styles.planOneOff, monthly: styles.planMonthly, annual: styles.planAnnual, adviser: styles.planAdviser }
    return <span className={`${styles.planBadge} ${map[plan] || styles.planFree}`}>{plan || 'free'}</span>
  }

  const handleChangePlan = async (userId, plan) => {
    const { data: { session } } = await supabase.auth.getSession()
    await adminAction('updatePlan', { userId, plan }, session?.access_token)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u))
  }

  const handleSuspend = async (userId, suspended) => {
    const { data: { session } } = await supabase.auth.getSession()
    await adminAction('suspendUser', { userId, suspended: !suspended }, session?.access_token)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended: !suspended } : u))
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this user and all their data? This cannot be undone.')) return
    const { data: { session } } = await supabase.auth.getSession()
    await adminAction('deleteUser', { userId }, session?.access_token)
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleDeleteDoc = async (docId, filePath) => {
    if (!confirm('Delete this document and its report?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await adminAction('deleteDocument', { docId, filePath }, session?.access_token)
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  const handleAddUser = async () => {
    if (!form.email || !form.password) { setError('Email and password required'); return }
    setSaving(true); setError('')
    const { error: e } = await supabase.auth.admin.createUser({ email: form.email, password: form.password, email_confirm: true })
    if (e) { setError(e.message); setSaving(false); return }
    await fetchAll(); setModal(null); setForm({}); setSaving(false)
  }

  const handleAddCode = async () => {
    if (!newCode.trim()) return
    const { data: { session } } = await supabase.auth.getSession()
    await adminAction('addBetaCode', { code: newCode.trim().toUpperCase() }, session?.access_token)
    setNewCode('')
    fetchAll()
  }

  const handleDeactivateCode = async (id) => {
    const { data: { session } } = await supabase.auth.getSession()
    await adminAction('deactivateBetaCode', { id }, session?.access_token)
    fetchAll()
  }

  const filteredUsers = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredWorkspaces = workspaces.filter(w =>
    !search || w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.ownerEmail?.toLowerCase().includes(search.toLowerCase()) ||
    w.client_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className={styles.loadingWrap}>
      <div className={styles.loadingRing} />
      <span>Loading admin panel</span>
    </div>
  )

  return (
    <div className={styles.layout}>
      <AdminNav activeTab={tab} setTab={setTab} />

      <main className={styles.main}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && stats && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.kicker}>Admin · LeaseLens</div>
                <h1 className={styles.h1}>Overview</h1>
              </div>
              <div className={styles.liveTag}>● Live</div>
            </div>

            <div className={styles.statGrid}>
              {[
                { label: 'Total users', value: stats.totalUsers, sub: `${stats.paidUsers} paid`, color: 'var(--accent-mid)', sparkData: stats.monthlySignups },
                { label: 'MRR', value: stats.mrr, prefix: '$', sub: 'monthly recurring', color: 'var(--accent-lt)', sparkData: stats.monthlySignups },
                { label: 'Documents analysed', value: stats.totalDocs, sub: 'all time', color: 'var(--accent-mid)', sparkData: stats.monthlyDocs },
                { label: 'Workspaces', value: stats.totalWorkspaces, sub: 'across all advisers', color: 'var(--accent-lt)', sparkData: stats.monthlyDocs },
              ].map((s, i) => (
                <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className={styles.statTop}>
                    <div>
                      <div className={styles.statLabel}>{s.label}</div>
                      <div className={styles.statValue}><Counter value={s.value} prefix={s.prefix} /></div>
                      <div className={styles.statSub}>{s.sub}</div>
                    </div>
                    <Sparkline data={s.sparkData} color={s.color} />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.chartsRow}>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>New users</div>
                  <div className={styles.chartSub}>Last 6 months</div>
                </div>
                <BarChartComp data={stats.monthlySignups} color="var(--accent-mid)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>Documents uploaded</div>
                  <div className={styles.chartSub}>Last 6 months</div>
                </div>
                <BarChartComp data={stats.monthlyDocs} color="var(--accent-lt)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>Plan distribution</div>
                  <div className={styles.chartSub}>{stats.totalUsers} total users</div>
                </div>
                <div className={styles.planDistList}>
                  {[
                    { label: 'Free',    val: stats.planCounts.free,    color: 'var(--rule-soft)' },
                    { label: 'One-off', val: stats.planCounts.one_off,  color: '#60a5fa' },
                    { label: 'Monthly', val: stats.planCounts.monthly,  color: 'var(--accent-mid)' },
                    { label: 'Annual',  val: stats.planCounts.annual,   color: 'var(--risk-l)' },
                    { label: 'Adviser', val: stats.planCounts.adviser,  color: 'var(--accent-lt)' },
                  ].map(l => (
                    <div key={l.label} className={styles.planDistRow}>
                      <span className={styles.legendDot} style={{ background: l.color }} />
                      <span className={styles.legendLabel}>{l.label}</span>
                      <div className={styles.planDistTrack}>
                        <div className={styles.planDistFill} style={{
                          width: stats.totalUsers ? `${(l.val / stats.totalUsers) * 100}%` : '0%',
                          background: l.color
                        }} />
                      </div>
                      <span className={styles.legendVal}>{l.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.bottomRow}>
              <div className={styles.riskCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>Risk distribution</div>
                  <div className={styles.chartSub}>{stats.totalDocs} documents</div>
                </div>
                <div className={styles.riskBars}>
                  {[
                    { label: 'High',   value: stats.highRisk, color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
                    { label: 'Medium', value: stats.medRisk,  color: 'var(--risk-m)', bg: 'var(--risk-m-bg)' },
                    { label: 'Low',    value: stats.lowRisk,  color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
                  ].map(r => (
                    <div key={r.label} className={styles.riskBarRow}>
                      <span className={styles.riskBarLabel}>{r.label}</span>
                      <div className={styles.riskTrack}>
                        <div className={styles.riskFill} style={{
                          width: stats.totalDocs ? `${(r.value / stats.totalDocs) * 100}%` : '0%',
                          background: r.color
                        }} />
                      </div>
                      <span className={styles.riskCount} style={{ color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.healthCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>Platform health</div>
                </div>
                <div className={styles.healthItems}>
                  {[
                    { label: 'Beta codes issued',  value: stats.betaTotal,      sub: `${stats.betaUsed} used` },
                    { label: 'Waitlist signups',   value: stats.waitlistCount,  sub: 'pending launch' },
                    { label: 'Est. API cost (mo)', value: `~$${Math.round(stats.totalDocs * 0.08)}`, sub: 'based on avg tokens' },
                  ].map((h, i) => (
                    <div key={i} className={styles.healthItem}>
                      <div className={styles.healthValue}>{h.value}</div>
                      <div className={styles.healthLabel}>{h.label}</div>
                      <div className={styles.healthSub}>{h.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.recentCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>Recent signups</div>
                  <button className={styles.viewAll} onClick={() => setTab('users')}>View all →</button>
                </div>
                <div className={styles.recentList}>
                  {users.slice(0, 6).map(u => (
                    <div key={u.id} className={styles.recentRow}>
                      <div className={styles.recentAvatar}>{u.email?.[0]?.toUpperCase()}</div>
                      <div className={styles.recentInfo}>
                        <div className={styles.recentEmail}>{u.email}</div>
                        <div className={styles.recentDate}>{formatDate(u.created_at)}</div>
                      </div>
                      {planBadge(u.plan)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.kicker}>Admin · Users</div>
                <h1 className={styles.h1}>Users <span className={styles.count}>{users.length}</span></h1>
              </div>
              <div className={styles.headerActions}>
                <input className={`input ${styles.searchInput}`} placeholder="Search by email..." value={search} onChange={e => setSearch(e.target.value)} />
                <button className="btn-primary" onClick={() => { setModal({ type: 'addUser' }); setForm({}); setError('') }}>+ Add user</button>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th className={styles.hideMobile}>Scans</th>
                    <th className={styles.hideMobile}>Docs</th>
                    <th className={styles.hideMobile}>Reports</th>
                    <th>Status</th>
                    <th className={styles.hideMobile}>Joined</th>
                    <th className={styles.hideMobile}>Change plan</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={u.suspended ? styles.suspendedRow : ''}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.avatar}>{u.email?.[0]?.toUpperCase()}</div>
                          <div>
                            <div className={styles.emailCell}>{u.email}</div>
                            <div className={styles.uidCell}>{u.id?.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>{planBadge(u.plan)}</td>
                      <td className={styles.hideMobile}>
                        {['monthly', 'annual'].includes(u.plan)
                          ? `${u.monthly_scans_used || 0}/10`
                          : u.plan === 'one_off' ? `${u.scan_credits || 0} credits`
                          : u.plan === 'adviser' ? 'Unlimited'
                          : `${u.free_scans_used || 0}/1`}
                      </td>
                      <td className={styles.hideMobile}>{documents.filter(d => d.user_id === u.id).length}</td>
                      <td className={styles.hideMobile}>{reports.filter(r => r.user_id === u.id).length}</td>
                      <td>
                        <span className={u.suspended ? styles.tagSuspended : styles.tagActive}>
                          {u.suspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className={styles.hideMobile}>{formatDate(u.created_at)}</td>
                      <td className={styles.hideMobile}>
                        <select className={styles.planSelect} value={u.plan || 'free'} onChange={e => handleChangePlan(u.id, e.target.value)}>
                          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button className={u.suspended ? styles.activateBtn : styles.suspendBtn} onClick={() => handleSuspend(u.id, u.suspended)}>
                            {u.suspended ? 'Reactivate' : 'Suspend'}
                          </button>
                          {u.email !== ADMIN_EMAIL && (
                            <button className={styles.deleteBtn} onClick={() => handleDeleteUser(u.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WORKSPACES ── */}
        {tab === 'workspaces' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.kicker}>Admin · Workspaces</div>
                <h1 className={styles.h1}>Workspaces <span className={styles.count}>{workspaces.length}</span></h1>
              </div>
              <div className={styles.headerActions}>
                <input className={`input ${styles.searchInput}`} placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Workspace</th>
                    <th>Owner</th>
                    <th className={styles.hideMobile}>Client</th>
                    <th>Negotiations</th>
                    <th className={styles.hideMobile}>Logo</th>
                    <th className={styles.hideMobile}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.map(ws => (
                    <tr key={ws.id}>
                      <td>
                        <div className={styles.wsNameCell}>{ws.name}</div>
                        <div className={styles.uidCell}>{ws.id.slice(0, 8)}...</div>
                      </td>
                      <td className={styles.emailCell}>{ws.ownerEmail}</td>
                      <td className={styles.hideMobile}>{ws.client_name || <span style={{ color: 'var(--ink-light)' }}>—</span>}</td>
                      <td>{ws.negCount}</td>
                      <td className={styles.hideMobile}>
                        {ws.logo_path
                          ? <span className={styles.tagActive}>Yes</span>
                          : <span style={{ color: 'var(--ink-light)', fontSize: 12 }}>—</span>}
                      </td>
                      <td className={styles.hideMobile}>{formatDate(ws.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === 'documents' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.kicker}>Admin · Documents</div>
                <h1 className={styles.h1}>Documents <span className={styles.count}>{documents.length}</span></h1>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th className={styles.hideMobile}>Negotiation</th>
                    <th className={styles.hideMobile}>Version</th>
                    <th>Risk</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td className={styles.filenameCell}>{doc.filename}</td>
                      <td className={styles.hideMobile}>{doc.negotiations?.property_name || '—'}</td>
                      <td className={styles.hideMobile}>v{doc.version_number}</td>
                      <td>{riskBadge(doc.overall_risk)}</td>
                      <td>{formatDate(doc.uploaded_at)}</td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button className={styles.viewBtn} onClick={() => navigate(`/admin/report/${doc.id}`)}>View report</button>
                          <button className={styles.deleteBtn} onClick={() => handleDeleteDoc(doc.id, doc.file_path)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === 'reports' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.kicker}>Admin · Reports</div>
                <h1 className={styles.h1}>Reports <span className={styles.count}>{reports.length}</span></h1>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Report ID</th><th className={styles.hideMobile}>Document ID</th><th>Generated</th><th>View</th></tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td className={styles.monoCell}>{r.id.slice(0, 14)}...</td>
                      <td className={styles.hideMobile}>{r.document_id.slice(0, 14)}...</td>
                      <td>{formatDate(r.created_at)}</td>
                      <td><button className={styles.viewBtn} onClick={() => navigate(`/admin/report/${r.document_id}`)}>View report</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BETA CODES ── */}
        {tab === 'beta' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.kicker}>Admin · Beta access</div>
                <h1 className={styles.h1}>Beta codes <span className={styles.count}>{betaCodes.length}</span></h1>
              </div>
            </div>
            <div className={styles.betaAddRow}>
              <input className={`input ${styles.codeInput}`} value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="Enter new code e.g. BETA2026" />
              <button className="btn-primary" onClick={handleAddCode}>Add code</button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Code</th><th>Status</th><th>Created</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {betaCodes.map(c => (
                    <tr key={c.id}>
                      <td className={styles.codeCell}>{c.code}</td>
                      <td><span className={c.used ? styles.tagSuspended : styles.tagActive}>{c.used ? 'Used' : 'Active'}</span></td>
                      <td>{formatDate(c.created_at)}</td>
                      <td>{!c.used && <button className={styles.suspendBtn} onClick={() => handleDeactivateCode(c.id)}>Deactivate</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WAITLIST ── */}
        {tab === 'waitlist' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <div className={styles.kicker}>Admin · Waitlist</div>
                <h1 className={styles.h1}>Waitlist <span className={styles.count}>{waitlist.length}</span></h1>
              </div>
              <button className="btn-primary" onClick={() => {
                const csv = 'email,joined\n' + waitlist.map(w => `${w.email},${w.created_at}`).join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'waitlist.csv'; a.click()
              }}>Export CSV</button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Email</th><th>Joined</th></tr></thead>
                <tbody>
                  {waitlist.map(w => (
                    <tr key={w.id}>
                      <td className={styles.emailCell}>{w.email}</td>
                      <td>{formatDate(w.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ADD USER MODAL */}
      {modal?.type === 'addUser' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add user</h2>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}><label>Email</label><input className="input" type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" /></div>
              <div className={styles.field}><label>Password</label><input className="input" type="password" value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="8+ characters" /></div>
              <div className={styles.field}><label>Plan</label><select className="input" value={form.plan || 'free'} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}>{PLANS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              {error && <div className={styles.modalError}>{error}</div>}
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAddUser} disabled={saving}>{saving ? 'Creating...' : 'Create user'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}