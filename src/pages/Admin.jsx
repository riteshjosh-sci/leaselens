import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AdminNav from '../components/AdminNav'
import styles from './Admin.module.css'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL
const PLANS = ['free', 'one_off', 'monthly', 'adviser']

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]           = useState('overview')
  const [loading, setLoading]   = useState(true)
  const [stats, setStats]       = useState(null)
  const [users, setUsers]       = useState([])
  const [documents, setDocuments] = useState([])
  const [reports, setReports]   = useState([])
  const [modal, setModal]       = useState(null) // { type: 'addUser' | 'editUser', data? }
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (user.email !== ADMIN_EMAIL) { navigate('/'); return }
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    setLoading(true)
    const [profilesRes, docsRes, reportsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('documents').select('*, negotiations(property_name)').order('uploaded_at', { ascending: false }).limit(200),
      supabase.from('reports').select('id, created_at, document_id, user_id').order('created_at', { ascending: false }).limit(200),
    ])

    const u = profilesRes.data || []
    const d = docsRes.data || []
    const r = reportsRes.data || []

    const riskCounts = d.reduce((acc, doc) => {
      acc[doc.overall_risk] = (acc[doc.overall_risk] || 0) + 1
      return acc
    }, {})

    // Build monthly signup data (last 6 months)
    const monthlySignups = buildMonthlyData(u, 'created_at')
    const monthlyDocs    = buildMonthlyData(d, 'uploaded_at')

    setStats({
      totalUsers:   u.length,
      totalDocs:    d.length,
      totalReports: r.length,
      highRisk:     riskCounts['HIGH']   || 0,
      medRisk:      riskCounts['MEDIUM'] || 0,
      lowRisk:      riskCounts['LOW']    || 0,
      planCounts:   PLANS.reduce((acc, p) => { acc[p] = u.filter(x => x.plan === p).length; return acc }, {}),
      monthlySignups,
      monthlyDocs,
    })
    setUsers(u)
    setDocuments(d)
    setReports(r)
    setLoading(false)
  }

  const buildMonthlyData = (rows, dateField) => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('en-AU', { month: 'short' })
      const count = rows.filter(r => {
        const rd = new Date(r[dateField])
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
    const map = { free: styles.planFree, one_off: styles.planOneOff, monthly: styles.planMonthly, adviser: styles.planAdviser }
    return <span className={`${styles.planBadge} ${map[plan] || ''}`}>{plan || 'free'}</span>
  }

  // ── User actions ──
  const handleChangePlan = async (userId, plan) => {
    await supabase.from('profiles').update({ plan }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u))
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this user and all their data? This cannot be undone.')) return
    await supabase.from('profiles').delete().eq('id', userId)
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleAddUser = async () => {
    if (!form.email || !form.password) { setError('Email and password are required'); return }
    setSaving(true)
    setError('')
    const { error: signUpError } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
    })
    if (signUpError) { setError(signUpError.message); setSaving(false); return }
    await fetchAll()
    setModal(null)
    setForm({})
    setSaving(false)
  }

  // ── Document actions ──
  const handleDeleteDoc = async (docId, filePath) => {
    if (!confirm('Delete this document and its report?')) return
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    await supabase.from('reports').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  // ── Mini bar chart ──
  const BarChart = ({ data, color }) => {
    const max = Math.max(...data.map(d => d.count), 1)
    return (
      <div className={styles.chart}>
        {data.map((d, i) => (
          <div key={i} className={styles.chartCol}>
            <div className={styles.chartBar} style={{ height: `${(d.count / max) * 100}%`, background: color }} />
            <div className={styles.chartLabel}>{d.label}</div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div className={styles.loadingWrap}>
      <div className={styles.loadingDot} />
      Loading admin panel...
    </div>
  )

  return (
    <div className={styles.layout}>
      <AdminNav activeTab={tab} setTab={setTab} />

      <main className={styles.main}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <h1 className={styles.h1}>Overview</h1>
              <span className={styles.lastUpdated}>Live data</span>
            </div>

            {/* Stat cards */}
            <div className={styles.statsGrid}>
              {[
                { label: 'Total users',    value: stats.totalUsers,   sub: `${stats.planCounts.monthly + stats.planCounts.adviser} paid` },
                { label: 'Documents',      value: stats.totalDocs,    sub: 'uploaded total' },
                { label: 'Reports',        value: stats.totalReports, sub: 'generated total' },
                { label: 'High risk docs', value: stats.highRisk,     sub: `${stats.totalDocs ? Math.round((stats.highRisk/stats.totalDocs)*100) : 0}% of total` },
              ].map(s => (
                <div key={s.label} className={styles.statCard}>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                  <div className={styles.statSub}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className={styles.chartsRow}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>New users — last 6 months</div>
                <BarChart data={stats.monthlySignups} color="var(--accent-mid)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Documents uploaded — last 6 months</div>
                <BarChart data={stats.monthlyDocs} color="var(--gold)" />
              </div>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Plan distribution</div>
                <div className={styles.planDist}>
                  {PLANS.map(p => (
                    <div key={p} className={styles.planRow}>
                      <span className={styles.planRowLabel}>{p}</span>
                      <div className={styles.planTrack}>
                        <div className={styles.planFill} style={{
                          width: stats.totalUsers ? `${(stats.planCounts[p] / stats.totalUsers) * 100}%` : '0%'
                        }} />
                      </div>
                      <span className={styles.planCount}>{stats.planCounts[p]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Risk distribution */}
            <div className={styles.riskRow}>
              {[
                { label: 'High risk',   value: stats.highRisk, color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
                { label: 'Medium risk', value: stats.medRisk,  color: 'var(--risk-m)', bg: 'var(--risk-m-bg)' },
                { label: 'Low risk',    value: stats.lowRisk,  color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
              ].map(r => (
                <div key={r.label} className={styles.riskCard} style={{ background: r.bg, borderColor: r.color }}>
                  <div className={styles.riskValue} style={{ color: r.color }}>{r.value}</div>
                  <div className={styles.riskLabel}>{r.label}</div>
                  <div className={styles.riskPct} style={{ color: r.color }}>
                    {stats.totalDocs ? Math.round((r.value / stats.totalDocs) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <h1 className={styles.h1}>Users <span className={styles.count}>{users.length}</span></h1>
              <button className="btn-primary" onClick={() => { setModal({ type: 'addUser' }); setForm({}); setError('') }}>
                + Add user
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Scans used</th>
                    <th>Joined</th>
                    <th>Change plan</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className={styles.emailCell}>{u.email}</td>
                      <td>{planBadge(u.plan)}</td>
                      <td>{u.free_scans_used || 0}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>
                        <select
                          className={styles.planSelect}
                          value={u.plan || 'free'}
                          onChange={e => handleChangePlan(u.id, e.target.value)}
                        >
                          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          Delete
                        </button>
                      </td>
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
              <h1 className={styles.h1}>Documents <span className={styles.count}>{documents.length}</span></h1>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Negotiation</th>
                    <th>Version</th>
                    <th>Risk</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td className={styles.filenameCell}>{doc.filename}</td>
                      <td className={styles.lightCell}>{doc.negotiations?.property_name || '—'}</td>
                      <td>v{doc.version_number}</td>
                      <td>{riskBadge(doc.overall_risk)}</td>
                      <td>{formatDate(doc.uploaded_at)}</td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button className={styles.viewBtn} onClick={() => navigate(`/admin/report/${doc.id}`)}>View</button>
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
              <h1 className={styles.h1}>Reports <span className={styles.count}>{reports.length}</span></h1>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Document ID</th>
                    <th>Generated</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td className={styles.monoCell}>{r.id.slice(0, 12)}...</td>
                      <td className={styles.monoCell}>{r.document_id.slice(0, 12)}...</td>
                      <td>{formatDate(r.created_at)}</td>
                      <td>
                        <button className={styles.viewBtn} onClick={() => navigate(`/admin/report/${r.document_id}`)}>
                          View report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── ADD USER MODAL ── */}
      {modal?.type === 'addUser' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add user</h2>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>Email</label>
                <input className="input" type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
              </div>
              <div className={styles.field}>
                <label>Password</label>
                <input className="input" type="password" value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="8+ characters" />
              </div>
              <div className={styles.field}>
                <label>Plan</label>
                <select className="input" value={form.plan || 'free'} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {error && <div className={styles.modalError}>{error}</div>}
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAddUser} disabled={saving}>
                {saving ? 'Creating...' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
