import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './Dashboard.module.css'

const MenuIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const BellIcon = () => <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6zM8 16a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const DocIcon = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const ArrowIcon = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ShieldIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5l-7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
const TrendIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 14l5-5 4 4 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ClockIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const CheckIcon = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [recentDocs, setRecentDocs] = useState([])
  const [stats, setStats] = useState({ total: 0, high: 0, analysed: 0, workspaces: 0 })
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const [wsRes, docsRes] = await Promise.all([
      supabase.from('workspaces').select(`
        id, name, client_name, created_at,
        negotiations ( id, status,
          documents ( id, filename, uploaded_at, overall_risk, version_number,
            reports ( id )
          )
        )
      `).eq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
      supabase.from('documents').select(`
        id, filename, uploaded_at, overall_risk, version_number,
        negotiations ( id, property_name, workspace_id ),
        reports ( id )
      `).eq('user_id', user.id).order('uploaded_at', { ascending: false }).limit(5),
    ])

    const ws = wsRes.data || []
    const docs = docsRes.data || []
    setWorkspaces(ws)
    setRecentDocs(docs)

    const totalDocs = ws.reduce((a, w) => a + w.negotiations.reduce((b, n) => b + (n.documents?.length || 0), 0), 0)
    const highDocs = ws.reduce((a, w) => a + w.negotiations.reduce((b, n) => b + (n.documents || []).filter(d => d.overall_risk === 'HIGH').length, 0), 0)
    setStats({ total: totalDocs, high: highDocs, analysed: totalDocs, workspaces: ws.length })
    setLoading(false)
  }

  const formatDate = d => {
    const date = new Date(d)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  const stripTimestamp = f => f?.replace(/^\d+_/, '').replace(/\.[^.]+$/, '') || ''
  const riskColor = { HIGH: 'var(--risk-h)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }
  const riskBg = { HIGH: 'var(--risk-h-bg)', MEDIUM: 'var(--risk-m-bg)', LOW: 'var(--risk-l-bg)' }

  const STAT_CARDS = [
    { label: 'Documents analysed', value: stats.analysed, icon: <DocIcon />, color: 'var(--navy)', sub: 'All time' },
    { label: 'High risk flagged', value: stats.high, icon: <ShieldIcon />, color: 'var(--risk-h)', sub: 'Needs attention' },
    { label: 'Active workspaces', value: stats.workspaces, icon: <TrendIcon />, color: 'var(--gold)', sub: 'Properties' },
    { label: 'Avg. analysis time', value: '22s', icon: <ClockIcon />, color: 'var(--risk-l)', sub: 'Per document' },
  ]

  if (loading) return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main">
        <div className={styles.loadingWrap}><div className={styles.loadingRing} /></div>
      </main>
    </div>
  )

  return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main className="app-main">
        {/* TOP BAR */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}><MenuIcon /></button>
            <div className={styles.topbarTitle}>
              <h1>Dashboard</h1>
              <p>Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}. Here's your overview.</p>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.bellBtn}><BellIcon /></button>
            <div className={styles.topbarAvatar}>{user?.email?.[0]?.toUpperCase()}</div>
            <button className="btn-gold btn-sm" onClick={() => navigate('/analyser')}>
              <PlusIcon /> Analyse document
            </button>
          </div>
        </div>

        <div className={styles.content}>

          {/* STAT CARDS */}
          <div className={styles.statGrid}>
            {STAT_CARDS.map((s, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.statTop}>
                  <div className={styles.statLabel}>{s.label}</div>
                  <div className={styles.statIconWrap} style={{ background: `${s.color}18`, color: s.color }}>
                    {s.icon}
                  </div>
                </div>
                <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
                <div className={styles.statSub}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className={styles.mainGrid}>
            {/* LEFT — Recent uploads + Workspaces */}
            <div className={styles.colMain}>

              {/* RECENT UPLOADS */}
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <h2 className={styles.panelTitle}>Recent documents</h2>
                    <p className={styles.panelSub}>Your latest analysed documents</p>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => navigate('/analyser')}>View all <ArrowIcon /></button>
                </div>
                <div className={styles.docList}>
                  {recentDocs.length === 0 ? (
                    <div className={styles.empty}>
                      <DocIcon />
                      <p>No documents yet. <button onClick={() => navigate('/analyser')}>Analyse your first document →</button></p>
                    </div>
                  ) : recentDocs.map(doc => (
                    <div key={doc.id} className={styles.docRow}
                      onClick={() => doc.reports?.[0]?.id && navigate(`/report/${doc.reports[0].id}`)}>
                      <div className={styles.docIcon}>
                        <span>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</span>
                      </div>
                      <div className={styles.docInfo}>
                        <div className={styles.docName}>{stripTimestamp(doc.filename)}</div>
                        <div className={styles.docMeta}>
                          {doc.negotiations?.property_name && <span>{doc.negotiations.property_name}</span>}
                          <span>{formatDate(doc.uploaded_at)}</span>
                        </div>
                      </div>
                      {doc.overall_risk && (
                        <span className={styles.riskPill} style={{ background: riskBg[doc.overall_risk], color: riskColor[doc.overall_risk] }}>
                          {doc.overall_risk}
                        </span>
                      )}
                      {doc.reports?.[0]?.id && (
                        <button className={styles.viewBtn} onClick={e => { e.stopPropagation(); navigate(`/report/${doc.reports[0].id}`) }}>
                          View <ArrowIcon />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* WORKSPACES */}
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <h2 className={styles.panelTitle}>Properties</h2>
                    <p className={styles.panelSub}>Active lease negotiations</p>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>View all <ArrowIcon /></button>
                </div>
                <div className={styles.wsGrid}>
                  {workspaces.slice(0, 4).map(ws => {
                    const docs = ws.negotiations.flatMap(n => n.documents || [])
                    const highCount = docs.filter(d => d.overall_risk === 'HIGH').length
                    const latestDoc = docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]
                    return (
                      <div key={ws.id} className={styles.wsCard} onClick={() => navigate(`/workspace/${ws.id}`)}>
                        <div className={styles.wsCardTop}>
                          <div className={styles.wsBadge}>{ws.name[0]?.toUpperCase()}</div>
                          <div className={styles.wsInfo}>
                            <div className={styles.wsName}>{ws.name}</div>
                            {ws.client_name && <div className={styles.wsClient}>{ws.client_name}</div>}
                          </div>
                        </div>
                        <div className={styles.wsStats}>
                          <span>{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
                          {highCount > 0 && <span className={styles.wsHigh}>{highCount} high risk</span>}
                        </div>
                        {latestDoc && <div className={styles.wsDate}>Updated {formatDate(latestDoc.uploaded_at)}</div>}
                      </div>
                    )
                  })}
                  <div className={styles.wsCardNew} onClick={() => navigate('/analyser')}>
                    <div className={styles.wsNewPlus}>+</div>
                    <div className={styles.wsNewLabel}>New property</div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — What you get + Security */}
            <div className={styles.colSide}>

              {/* QUICK ACTIONS */}
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Quick actions</h2>
                </div>
                <div className={styles.actions}>
                  {[
                    { label: 'Analyse a lease', sub: 'Upload PDF or DOCX', action: () => navigate('/analyser') },
                    { label: 'Analyse an HOA', sub: 'Heads of agreement', action: () => navigate('/analyser') },
                    { label: 'Compare versions', sub: 'Track changes', action: () => navigate('/dashboard') },
                    { label: 'View all reports', sub: 'Your saved analyses', action: () => navigate('/dashboard') },
                  ].map((a, i) => (
                    <button key={i} className={styles.actionBtn} onClick={a.action}>
                      <div className={styles.actionDot} />
                      <div>
                        <div className={styles.actionLabel}>{a.label}</div>
                        <div className={styles.actionSub}>{a.sub}</div>
                      </div>
                      <ArrowIcon />
                    </button>
                  ))}
                </div>
              </div>

              {/* SECURITY */}
              <div className={styles.securityCard}>
                <div className={styles.securityHead}>
                  <ShieldIcon />
                  <div className={styles.securityTitle}>Your security is our priority</div>
                </div>
                <div className={styles.securityList}>
                  {[
                    'Documents encrypted in transit and at rest',
                    'Row-level security — only you see your data',
                    'Anonymised clause data only, no PII retained',
                  ].map((item, i) => (
                    <div key={i} className={styles.securityItem}>
                      <span className={styles.securityCheck}><CheckIcon /></span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* DISCLAIMER */}
              <div className={styles.disclaimerCard}>
                <p>LeaseLens provides informational analysis to support negotiation. It does not constitute legal advice. Always consult a qualified Australian solicitor before signing.</p>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
