import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './WorkspaceList.module.css'

const MenuIcon   = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const PlusIcon   = () => <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6"/><path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const ArrowIcon  = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const FolderIcon = () => <svg width="28" height="28" viewBox="0 0 20 20" fill="none"><path d="M2 6a2 2 0 0 1 2-2h3.5l2 2H16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="1.4"/></svg>
const DocIcon    = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>

export default function WorkspaceList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [newName, setNewName]       = useState('')
  const [newClient, setNewClient]   = useState('')
  const [showModal, setShowModal]   = useState(false)

  useEffect(() => { if (!user) { navigate('/login'); return }; fetchAll() }, [user])

  const fetchAll = async () => {
    const { data } = await supabase
      .from('workspaces')
      .select(`id, name, client_name, created_at,
        negotiations ( id, property_name, status,
          documents ( id, filename, overall_risk, uploaded_at, version_number,
            reports ( id ) ) )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setWorkspaces(data || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const { data } = await supabase.from('workspaces').insert({
      user_id: user.id, name: newName.trim(), client_name: newClient.trim() || null
    }).select().single()
    if (data) {
      setWorkspaces(prev => [{ ...data, negotiations: [] }, ...prev])
      setShowModal(false)
      setNewName(''); setNewClient('')
      navigate(`/workspace/${data.id}`)
    }
    setCreating(false)
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '').replace(/\.[^.]+$/, '') || ''

  const filtered = workspaces.filter(ws =>
    ws.name.toLowerCase().includes(search.toLowerCase()) ||
    ws.client_name?.toLowerCase().includes(search.toLowerCase())
  )

  const getStats = (ws) => {
    const docs = ws.negotiations.flatMap(n => n.documents || [])
    const high = docs.filter(d => d.overall_risk === 'HIGH').length
    const latest = docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]
    const hasReport = docs.some(d => d.reports?.length > 0)
    return { docs: docs.length, negs: ws.negotiations.length, high, latest, hasReport }
  }

  const getStatus = (ws) => {
    const stats = getStats(ws)
    if (stats.high > 0) return { label: 'Needs attention', cls: styles.statusHigh }
    if (stats.docs === 0) return { label: 'No documents', cls: styles.statusNone }
    return { label: 'Reviewing', cls: styles.statusOk }
  }

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
              <h1 className={styles.h1}>Workspaces</h1>
              <p className={styles.sub}>{workspaces.length} propert{workspaces.length !== 1 ? 'ies' : 'y'} under negotiation</p>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.searchWrap}>
              <SearchIcon />
              <input className={styles.searchInput} placeholder="Search workspaces..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn-gold btn-sm" onClick={() => setShowModal(true)}>
              <PlusIcon /> New workspace
            </button>
          </div>
        </div>

        <div className={styles.content}>

          {/* STAT STRIP */}
          <div className={styles.statStrip}>
            {[
              { label: 'Total workspaces', value: workspaces.length },
              { label: 'Active negotiations', value: workspaces.reduce((a, ws) => a + ws.negotiations.length, 0) },
              { label: 'Documents analysed', value: workspaces.reduce((a, ws) => a + ws.negotiations.flatMap(n => n.documents || []).length, 0) },
              { label: 'High risk flagged', value: workspaces.reduce((a, ws) => a + ws.negotiations.flatMap(n => n.documents || []).filter(d => d.overall_risk === 'HIGH').length, 0), color: 'var(--risk-h)' },
            ].map((s, i) => (
              <div key={i} className={styles.statCard}>
                <div className={styles.statVal} style={s.color ? { color: s.color } : {}}>{s.value}</div>
                <div className={styles.statLbl}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* GRID */}
          {filtered.length === 0 && search ? (
            <div className={styles.empty}>
              <SearchIcon />
              <p>No workspaces matching "{search}"</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><FolderIcon /></div>
              <h3>No workspaces yet</h3>
              <p>Create a workspace for each property you're negotiating.</p>
              <button className="btn-gold" onClick={() => setShowModal(true)}><PlusIcon /> Create workspace</button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(ws => {
                const stats = getStats(ws)
                const status = getStatus(ws)
                return (
                  <div key={ws.id} className={styles.card} onClick={() => navigate(`/workspace/${ws.id}`)}>
                    <div className={styles.cardTop}>
                      <div className={styles.badge}>{ws.name[0]?.toUpperCase()}</div>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardName}>{ws.name}</div>
                        {ws.client_name && <div className={styles.cardClient}>{ws.client_name}</div>}
                      </div>
                      <span className={`${styles.statusChip} ${status.cls}`}>{status.label}</span>
                    </div>

                    <div className={styles.cardStats}>
                      <div className={styles.cs}>
                        <div className={styles.csVal}>{stats.negs}</div>
                        <div className={styles.csLbl}>Negotiations</div>
                      </div>
                      <div className={styles.csDivider} />
                      <div className={styles.cs}>
                        <div className={styles.csVal}>{stats.docs}</div>
                        <div className={styles.csLbl}>Documents</div>
                      </div>
                      <div className={styles.csDivider} />
                      <div className={styles.cs}>
                        <div className={styles.csVal} style={stats.high > 0 ? { color: 'var(--risk-h)' } : {}}>{stats.high}</div>
                        <div className={styles.csLbl}>High risk</div>
                      </div>
                    </div>

                    {/* Negotiations preview */}
                    {ws.negotiations.length > 0 && (
                      <div className={styles.negPreview}>
                        {ws.negotiations.slice(0, 2).map(n => {
                          const latestDoc = (n.documents || []).sort((a, b) => b.version_number - a.version_number)[0]
                          return (
                            <div key={n.id} className={styles.negRow}
                              onClick={e => { e.stopPropagation(); navigate(`/negotiation/${n.id}`) }}>
                              <DocIcon />
                              <span className={styles.negName}>{stripTimestamp(n.property_name)}</span>
                              {latestDoc?.overall_risk && (
                                <span className={styles.negRisk} style={{
                                  color: latestDoc.overall_risk === 'HIGH' ? 'var(--risk-h)' : latestDoc.overall_risk === 'MEDIUM' ? 'var(--risk-m)' : 'var(--risk-l)'
                                }}>● {latestDoc.overall_risk}</span>
                              )}
                            </div>
                          )
                        })}
                        {ws.negotiations.length > 2 && (
                          <div className={styles.moreNegs}>+{ws.negotiations.length - 2} more</div>
                        )}
                      </div>
                    )}

                    <div className={styles.cardFoot}>
                      <span className={styles.cardDate}>
                        {stats.latest ? `Updated ${formatDate(stats.latest.uploaded_at)}` : `Created ${formatDate(ws.created_at)}`}
                      </span>
                      <span className={styles.openLink}>Open <ArrowIcon /></span>
                    </div>
                  </div>
                )
              })}

              {/* New workspace card */}
              <div className={`${styles.card} ${styles.cardNew}`} onClick={() => setShowModal(true)}>
                <div className={styles.newPlus}>+</div>
                <div className={styles.newLabel}>New workspace</div>
                <div className={styles.newSub}>Add a property to negotiate</div>
              </div>
            </div>
          )}
        </div>

        {/* CREATE MODAL */}
        {showModal && (
          <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHead}>
                <h2>New workspace</h2>
                <button className={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.field}>
                  <label>Property / workspace name <span className={styles.req}>*</span></label>
                  <input className="input" placeholder="e.g. Shop 4, 123 Collins St Melbourne"
                    value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
                </div>
                <div className={styles.field}>
                  <label>Client name <span className={styles.opt}>(optional)</span></label>
                  <input className="input" placeholder="e.g. Craftsman Barbers"
                    value={newClient} onChange={e => setNewClient(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                </div>
                <div className={styles.modalFoot}>
                  <button className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn-gold" onClick={handleCreate} disabled={!newName.trim() || creating}>
                    {creating ? 'Creating…' : 'Create workspace'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
