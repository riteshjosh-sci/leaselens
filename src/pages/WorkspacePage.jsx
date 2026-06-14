import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './WorkspacePage.module.css'

const MenuIcon    = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const PlusIcon    = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const SettingsIcon= () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const DocIcon     = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const ArrowIcon   = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const TrashIcon   = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4h4v2M7 9v6M13 9v6M5 6l1 10h8l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const SearchIcon  = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6"/><path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const CheckIcon   = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>

const RISK_COLOR  = { HIGH:'var(--risk-h)', MEDIUM:'var(--risk-m)', LOW:'var(--risk-l)' }
const RISK_BG     = { HIGH:'var(--risk-h-bg)', MEDIUM:'var(--risk-m-bg)', LOW:'var(--risk-l-bg)' }
const RISK_BORDER = { HIGH:'var(--risk-h-border)', MEDIUM:'var(--risk-m-border)', LOW:'var(--risk-l-border)' }

export default function WorkspacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ws, setWs]             = useState(null)
  const [negotiations, setNeg]  = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [view, setView]         = useState('grid') // 'grid' | 'list'

  useEffect(() => { if (!user) { navigate('/login'); return }; fetchAll() }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('negotiations').select(`
        id, property_name, created_at, status, lifecycle,
        documents ( id, filename, version_number, uploaded_at, overall_risk, file_path,
          reports ( id ) )
      `).eq('workspace_id', id).order('created_at', { ascending: false }),
    ])
    if (wsRes.error || !wsRes.data) { navigate('/workspaces'); return }
    setWs(wsRes.data)
    setNeg(negsRes.data || [])
    setLoading(false)
  }

  const handleDeleteNeg = async (e, negId) => {
    e.stopPropagation()
    if (!confirm('Delete this negotiation and all its documents?')) return
    const neg = negotiations.find(n => n.id === negId)
    const paths = (neg?.documents || []).map(d => d.file_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('documents').remove(paths)
    await supabase.from('jobs').delete().eq('negotiation_id', negId)
    await supabase.from('negotiations').delete().eq('id', negId)
    setNeg(prev => prev.filter(n => n.id !== negId))
  }

  const handleAnalyse = async () => {
    navigate('/analyser', { state: { workspaceId: id } })
  }

  const handleAddVersion = async (e, negId) => {
    e.stopPropagation()
    navigate('/analyser', { state: { negotiationId: negId, workspaceId: id } })
  }

  const formatDate = d => {
    const date = new Date(d)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
    return date.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })
  }

  const stripName = f => (f||'').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

  const getStatus = (neg) => {
    const docs = neg.documents || []
    if (docs.some(d => d.overall_risk === 'HIGH')) return { label:'Needs attention', cls:styles.chipHigh }
    if (docs.length === 0) return { label:'No documents', cls:styles.chipNone }
    return { label:'Reviewing', cls:styles.chipOk }
  }

  const getLifecycleLabel = (lc) => ({
    reviewing:'Reviewing', counter_prepared:'Counter prepared',
    sent:'Sent to agent', awaiting:'Awaiting response', agreed:'Agreed'
  }[lc] || 'Reviewing')

  const totalDocs  = negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const highCount  = negotiations.reduce((a, n) => a + (n.documents||[]).filter(d => d.overall_risk==='HIGH').length, 0)
  const agreedCount= negotiations.filter(n => n.lifecycle === 'agreed').length

  const filtered = negotiations.filter(n =>
    stripName(n.property_name).toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main"><div className={styles.loading}><div className={styles.ring} /></div></main>
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
            <div>
              <div className={styles.crumb}>
                <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                <span>›</span>
                <button onClick={() => navigate('/workspaces')}>Workspaces</button>
                <span>›</span>
                <span>{ws.name}</span>
              </div>
              <div className={styles.wsHead}>
                <div className={styles.wsBadge}>{ws.name[0]?.toUpperCase()}</div>
                <div>
                  <div className={styles.wsKicker}>Workspace · Property</div>
                  <h1 className={styles.h1}>{ws.name}</h1>
                  {ws.client_name && <p className={styles.sub}>{ws.client_name}</p>}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <button className="btn-outline btn-sm" onClick={() => navigate(`/workspace/${id}/settings`)}>
              <SettingsIcon /> Settings
            </button>
            <button className="btn-gold btn-sm" onClick={handleAnalyse}>
              <PlusIcon /> Analyse document
            </button>
          </div>
        </div>

        {/* STAT BAR */}
        <div className={styles.statBar}>
          {[
            { label:'NEGOTIATIONS', value: negotiations.length, sub:'active' },
            { label:'DOCUMENTS', value: totalDocs, sub:'uploaded' },
            { label:'HIGH PRIORITY', value: highCount, sub:'clauses', color:'var(--risk-h)' },
            { label:'AGREED', value: agreedCount, sub:'finalised', color:'var(--risk-l)' },
          ].map((s, i) => (
            <div key={i} className={styles.statItem}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statValue} style={s.color ? {color:s.color} : {}}>{s.value}</div>
              <div className={styles.statSub}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div className={styles.content}>

          {/* TOOLBAR */}
          <div className={styles.toolbar}>
            <div className={styles.sectionHead}>
              <span className={styles.shLabel}>Negotiations</span>
              <span className={styles.shCount}>{negotiations.length} active</span>
              <span className={styles.shLine} />
            </div>
            <div className={styles.toolbarRight}>
              <div className={styles.searchWrap}>
                <SearchIcon />
                <input className={styles.searchInput} placeholder="Search negotiations..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className={styles.viewToggle}>
                <button className={`${styles.vtBtn} ${view==='grid' ? styles.vtActive : ''}`} onClick={() => setView('grid')}>⊞</button>
                <button className={`${styles.vtBtn} ${view==='list' ? styles.vtActive : ''}`} onClick={() => setView('list')}>☰</button>
              </div>
            </div>
          </div>

          {/* EMPTY */}
          {negotiations.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><DocIcon /></div>
              <h3>No negotiations yet</h3>
              <p>Upload a lease or HOA to start your first analysis.</p>
              <button className="btn-gold" onClick={handleAnalyse}><PlusIcon /> Analyse document</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <SearchIcon />
              <p>No negotiations matching "{search}"</p>
            </div>
          ) : view === 'grid' ? (
            /* GRID VIEW */
            <div className={styles.grid}>
              {filtered.map(neg => {
                const docs = (neg.documents || []).sort((a,b) => b.version_number - a.version_number)
                const latest = docs[0]
                const status = getStatus(neg)
                const name   = stripName(neg.property_name)
                const reportId = latest?.reports?.[0]?.id

                return (
                  <div key={neg.id} className={styles.card} onClick={() => navigate(`/negotiation/${neg.id}`)}>
                    <div className={styles.cardHead}>
                      <div className={styles.cardBadge}>{name[0]?.toUpperCase()}</div>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardName}>{name}</div>
                        <div className={styles.cardMeta}>
                          <DocIcon />
                          <span>{docs.length} document{docs.length!==1?'s':''}</span>
                        </div>
                      </div>
                      <span className={`${styles.chip} ${status.cls}`}>{status.label}</span>
                    </div>

                    {/* Latest doc risk */}
                    {latest?.overall_risk && (
                      <div className={styles.riskBar}>
                        <div className={styles.rbLeft}>
                          <div className={styles.rbDot} style={{background:RISK_COLOR[latest.overall_risk]}} />
                          <span className={styles.rbLabel}>{latest.overall_risk} RISK</span>
                        </div>
                        <span className={styles.rbVersion}>v{latest.version_number}</span>
                      </div>
                    )}

                    {/* Lifecycle */}
                    <div className={styles.lifecycle}>
                      <div className={styles.lcDot}
                        style={{background: neg.lifecycle === 'agreed' ? 'var(--risk-l)' : neg.lifecycle === 'reviewing' ? 'var(--navy-muted)' : 'var(--gold)'}} />
                      <span className={styles.lcLabel}>{getLifecycleLabel(neg.lifecycle)}</span>
                    </div>

                    <div className={styles.cardFoot}>
                      <span className={styles.cardDate}>
                        {latest ? `Updated ${formatDate(latest.uploaded_at)}` : `Created ${formatDate(neg.created_at)}`}
                      </span>
                      <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                        <button className={styles.actionBtn} onClick={e => handleAddVersion(e, neg.id)} title="Add version">
                          <PlusIcon />
                        </button>
                        <button className={styles.actionBtn} onClick={e => handleDeleteNeg(e, neg.id)} title="Delete">
                          <TrashIcon />
                        </button>
                      </div>
                      <span className={styles.openBtn}>Open <ArrowIcon /></span>
                    </div>
                  </div>
                )
              })}

              {/* New negotiation card */}
              <div className={`${styles.card} ${styles.cardNew}`} onClick={handleAnalyse}>
                <div className={styles.newPlus}>+</div>
                <div className={styles.newLabel}>New negotiation</div>
                <div className={styles.newSub}>Analyse a lease or HOA for this workspace</div>
              </div>
            </div>
          ) : (
            /* LIST VIEW */
            <div className={styles.listView}>
              <div className={styles.listHead}>
                <span>Negotiation</span>
                <span>Documents</span>
                <span>Risk</span>
                <span>Status</span>
                <span>Updated</span>
                <span></span>
              </div>
              {filtered.map(neg => {
                const docs   = (neg.documents||[]).sort((a,b) => b.version_number - a.version_number)
                const latest = docs[0]
                const status = getStatus(neg)
                const name   = stripName(neg.property_name)
                return (
                  <div key={neg.id} className={styles.listRow} onClick={() => navigate(`/negotiation/${neg.id}`)}>
                    <div className={styles.listNeg}>
                      <div className={styles.listBadge}>{name[0]?.toUpperCase()}</div>
                      <div>
                        <div className={styles.listName}>{name}</div>
                        <div className={styles.listMeta}>{docs.length} version{docs.length!==1?'s':''}</div>
                      </div>
                    </div>
                    <div className={styles.listDocs}>{docs.length}</div>
                    <div>
                      {latest?.overall_risk ? (
                        <span className={styles.riskPill} style={{
                          background:RISK_BG[latest.overall_risk],
                          color:RISK_COLOR[latest.overall_risk],
                          border:`1px solid ${RISK_BORDER[latest.overall_risk]}`
                        }}>{latest.overall_risk}</span>
                      ) : <span className={styles.noneTag}>—</span>}
                    </div>
                    <span className={`${styles.chip} ${status.cls}`}>{status.label}</span>
                    <span className={styles.listDate}>{latest ? formatDate(latest.uploaded_at) : formatDate(neg.created_at)}</span>
                    <div className={styles.listActions} onClick={e => e.stopPropagation()}>
                      <button className={styles.actionBtn} onClick={e => handleAddVersion(e, neg.id)}><PlusIcon /></button>
                      <button className={styles.actionBtn} onClick={e => handleDeleteNeg(e, neg.id)}><TrashIcon /></button>
                      <button className={styles.openBtn2}>Open <ArrowIcon /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
