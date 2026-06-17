import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import ReviewTab from './ReviewTab'
import CompareTab from './CompareTab'
import DocumentsTab from './DocumentsTab'
import ActivityTab from './ActivityTab'
import styles from './NegotiationDetail.module.css'

const TABS = [
  { key: 'review',    label: 'Review' },
  { key: 'compare',   label: 'Compare' },
  { key: 'documents', label: 'Documents' },
  { key: 'activity',  label: 'Activity' },
]

export default function NegotiationDetail() {
  const { id: negId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [neg,     setNeg]     = useState(null)
  const [ws,      setWs]      = useState(null)
  const [docs,    setDocs]    = useState([])
  const [loading, setLoading] = useState(true)

  // Derive active tab from URL hash or default to review
  const hashTab = location.hash.replace('#', '')
  const activeTab = TABS.find(t => t.key === hashTab)?.key || 'review'

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
    const onFocus = () => fetchAll()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [negId, user])

  const fetchAll = async () => {
    const { data: negData, error } = await supabase
      .from('negotiations')
      .select(`
        id, property_name, created_at, status, lifecycle, workspace_id,
        documents (
          id, filename, version_number, uploaded_at, overall_risk, file_path,
          reports ( id, report_json, created_at )
        )
      `)
      .eq('id', negId)
      .single()

    if (error || !negData) { navigate('/dashboard'); return }
    setNeg(negData)

    const sortedDocs = (negData.documents || []).sort((a, b) => b.version_number - a.version_number)
    setDocs(sortedDocs)

    if (negData.workspace_id) {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('id, name, client_name, logo_path, created_at')
        .eq('id', negData.workspace_id)
        .single()
      setWs(wsData)
    }

    setLoading(false)
  }

  const setTab = (key) => {
    navigate(`${location.pathname}#${key}`, { replace: true })
  }

  const handleAddVersion = () => {
    navigate('/analyser', { state: { negotiationId: negId, workspaceId: ws?.id } })
  }

  // Status chip derived from lifecycle
  const getStatusChip = () => {
    if (!neg) return { label: 'Loading', cls: '' }
    const lc = neg.lifecycle
    if (lc === 'agreed')            return { label: 'Agreed', cls: styles.statusDone }
    if (lc === 'awaiting')          return { label: 'Awaiting landlord', cls: styles.statusWait }
    if (lc === 'sent')              return { label: 'Sent to agent', cls: styles.statusWait }
    if (lc === 'counter_prepared')  return { label: 'Counter prepared', cls: '' }
    return { label: 'In review', cls: '' }
  }

  const status = getStatusChip()

  if (loading) return <><Nav /><div className={styles.loading}>Loading…</div></>

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.crumb}>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <span>›</span>
          {ws && (
            <>
              <button onClick={() => navigate(`/workspace/${ws.id}`)}>{ws.name}</button>
              <span>›</span>
            </>
          )}
          <span>{neg.property_name || 'Negotiation'}</span>
        </div>

        {/* WORKSPACE HEADER */}
        <div className={styles.wsHead}>
          <div className={styles.wsId}>
            <div className={styles.wsBadge}>{(neg.property_name || 'N')[0]?.toUpperCase()}</div>
            <div className={styles.wsNameWrap}>
              <div className={styles.wsKicker}>Workspace</div>
              <h1 className={styles.wsName}>{neg.property_name || 'Unnamed negotiation'}</h1>
              {ws?.client_name && <div className={styles.wsSub}>{ws.client_name}</div>}
            </div>
          </div>
          <div className={styles.wsActions}>
            <span className={`${styles.statusChip} ${status.cls}`}>
              <span className={styles.statusD} />{status.label}
            </span>
            <button className="btn-outline btn-sm" onClick={handleAddVersion}>
              + Add version
            </button>
          </div>
        </div>

        {/* TAB BAR */}
        <div className={styles.wstabs}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.wstab} ${activeTab === tab.key ? styles.wstabActive : ''}`}
              onClick={() => setTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'documents' && docs.length > 0 && (
                <span className={styles.wc}>{docs.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        {activeTab === 'review' && (
          <ReviewTab
            negId={negId}
            neg={neg}
            ws={ws}
            docs={docs}
          />
        )}
        {activeTab === 'compare' && (
          <CompareTab
            negId={negId}
            docs={docs}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab
            negId={negId}
            docs={docs}
            setDocs={setDocs}
            onAddVersion={handleAddVersion}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab
            neg={neg}
            docs={docs}
            ws={ws}
          />
        )}

      </div>
      <Footer />
    </>
  )
}
