import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './WorkspacePage.module.css'

export default function WorkspacePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [ws, setWs] = useState(null)
  const [negotiations, setNeg] = useState([])
  const [keyDates, setKeyDates] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
  }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('negotiations')
        .select(`
          id, property_name, tenant_name, premises_address, created_at, status, lifecycle,
          documents (
            id, filename, version_number, uploaded_at, overall_risk
          )
        `)
        .eq('workspace_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ])

    if (wsRes.error || !wsRes.data) { navigate('/dashboard'); return }
    setWs(wsRes.data)
    const negs = negsRes.data || []
    setNeg(negs)

    // Key dates — pull lease_data for the most recently uploaded document
    const allDocs = negs.flatMap(n => n.documents || [])
    const latestDoc = allDocs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]
    if (latestDoc) {
      const { data: ld } = await supabase
        .from('lease_data')
        .select('commencement_date, expiry_date')
        .eq('document_id', latestDoc.id)
        .maybeSingle()
      if (ld && (ld.commencement_date || ld.expiry_date)) setKeyDates(ld)
    }

    setLoading(false)
  }

  const handleDeleteNeg = async (negId, e) => {
    e.stopPropagation()
    if (!confirm('Delete this negotiation and all its documents?')) return
    await supabase.from('jobs').delete().eq('negotiation_id', negId)
    await supabase.from('negotiations').delete().eq('id', negId)
    setNeg(prev => prev.filter(n => n.id !== negId))
  }

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const cleanName = (neg) =>
    (neg.property_name || 'Unnamed').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

  const getDocSummary = (neg) => {
    const docs = neg.documents || []
    const hoaCount   = docs.filter(d => d.filename?.toLowerCase().includes('hoa')).length
    const leaseCount = docs.filter(d => !d.filename?.toLowerCase().includes('hoa')).length
    const parts = []
    if (leaseCount > 0) parts.push(`${leaseCount} lease${leaseCount > 1 ? 's' : ''}`)
    if (hoaCount > 0)   parts.push(`${hoaCount} HOA${hoaCount > 1 ? 's' : ''}`)
    if (parts.length === 0 && docs.length > 0) parts.push(`${docs.length} document${docs.length > 1 ? 's' : ''}`)
    return parts.join(' · ') || 'No documents'
  }

  const getStatusChip = (neg) => {
    const docs = neg.documents || []
    if (neg.lifecycle === 'agreed')           return { label: 'Agreed', cls: styles.statusDone }
    if (neg.lifecycle === 'awaiting')         return { label: 'Awaiting landlord', cls: styles.statusWait }
    if (neg.lifecycle === 'sent')             return { label: 'Sent to agent', cls: styles.statusWait }
    if (neg.lifecycle === 'counter_prepared') return { label: 'Counter prepared', cls: styles.statusCounter }
    if (docs.length === 0)                    return { label: 'No documents', cls: styles.statusMuted }
    return { label: 'Reviewing', cls: '' }
  }

  const getLatestDate = (neg) => {
    const docs = neg.documents || []
    if (!docs.length) return null
    return docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0]?.uploaded_at
  }

  // Sanity-check extracted values — same guard used on Properties/Dashboard
  const CLAUSE_WORDS = ['takes a lease', 'landlord', 'herein', 'pursuant', 'thereof', 'together with', 'non-exclusive', 'the term']
  const isClauseText = v => !v || v.length > 150 || CLAUSE_WORDS.some(w => v.toLowerCase().includes(w))
  const negWithData = negotiations.find(n => n.tenant_name || n.premises_address)
  const extractedTenant  = !isClauseText(negWithData?.tenant_name)  ? negWithData.tenant_name  : null
  const extractedAddress = !isClauseText(negWithData?.premises_address) ? negWithData.premises_address : null

  const formatKeyDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatCountdown = (d) => {
    const days = Math.round((new Date(d) - new Date()) / 86400000)
    if (days < 0) return 'Passed'
    if (days > 365) return `${(days / 365).toFixed(1)} yrs`
    return `${days} days`
  }

  const isDateSoon = (d) => {
    const days = Math.round((new Date(d) - new Date()) / 86400000)
    return days >= 0 && days <= 30
  }

  const docTypeSummary = () => {
    const allDocs = negotiations.flatMap(n => n.documents || [])
    const hoaDocs   = allDocs.filter(d => d.filename?.toLowerCase().includes('hoa'))
    const leaseDocs = allDocs.filter(d => !d.filename?.toLowerCase().includes('hoa'))
    return [
      { label: 'Heads of agreement', count: hoaDocs.length },
      { label: 'Lease versions', count: leaseDocs.length },
    ]
  }

  if (loading || !ws) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  return (
    <AppSidebar>
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.crumb}>
          <button onClick={() => navigate('/properties')}>Properties</button>
          <span>›</span>
          <span>{ws.name}</span>
        </div>

        {/* HEADER */}
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <div className={styles.wsBadge}>{ws.name[0]?.toUpperCase()}</div>
            <div>
              <h1 className={styles.h1}>{ws.name}</h1>
              <div className={styles.sub}>
                {extractedAddress || ws.name}
                {(extractedTenant || ws.client_name) && <> · Tenant: <strong>{extractedTenant || ws.client_name}</strong></>}
              </div>
            </div>
          </div>
          <div className={styles.headActions}>
            <button className="btn-outline btn-sm" onClick={() => navigate(`/workspace/${id}/settings`)}>
              Settings
            </button>
            <button className="btn-ink btn-sm" onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
              + New negotiation
            </button>
          </div>
        </div>

        <div className={styles.twoCol}>
          {/* NEGOTIATIONS */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelBar} />
              <span className={styles.panelTitle}>Negotiations</span>
            </div>
            {negotiations.length === 0 ? (
              <div className={styles.empty}>
                <p>No negotiations yet. Analyse a lease or HOA to get started.</p>
                <button className="btn-ink btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
                  Analyse document →
                </button>
              </div>
            ) : (
              negotiations.map(neg => {
                const status = getStatusChip(neg)
                const latestDate = getLatestDate(neg)
                return (
                  <div key={neg.id} className={styles.negRow} onClick={() => navigate(`/negotiation/${neg.id}`)}>
                    <div className={styles.negMain}>
                      <div className={styles.negName}>{cleanName(neg)}</div>
                      <div className={styles.negMeta}>{getDocSummary(neg)}</div>
                    </div>
                    <div className={styles.negRight}>
                      <span className={`${styles.negChip} ${status.cls}`}><span className={styles.d} />{status.label}</span>
                      <span className={styles.negDate}>{latestDate ? `Updated ${formatDate(latestDate)}` : `Created ${formatDate(neg.created_at)}`} →</span>
                    </div>
                    <button className={styles.delBtn} onClick={(e) => handleDeleteNeg(neg.id, e)} title="Delete negotiation">✕</button>
                  </div>
                )
              })
            )}
          </div>

          <div className={styles.sideCol}>
            {/* KEY DATES */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelBar} />
                <span className={styles.panelTitle}>Key dates</span>
              </div>
              {!keyDates?.commencement_date && !keyDates?.expiry_date ? (
                <div className={styles.empty}>No dates extracted from this lease yet.</div>
              ) : (
                <>
                  {keyDates.commencement_date && (
                    <div className={styles.kdRow}>
                      <div>
                        <div className={styles.kdLbl}>Commencement</div>
                        <div className={styles.kdDate}>{formatKeyDate(keyDates.commencement_date)}</div>
                      </div>
                    </div>
                  )}
                  {keyDates.expiry_date && (
                    <div className={styles.kdRow}>
                      <div>
                        <div className={styles.kdLbl}>Lease expiry</div>
                        <div className={styles.kdDate}>{formatKeyDate(keyDates.expiry_date)}</div>
                      </div>
                      <span className={`${styles.kdBadge} ${isDateSoon(keyDates.expiry_date) ? styles.kdBadgeSoon : styles.kdBadgeNormal}`}>{formatCountdown(keyDates.expiry_date)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* DOCUMENTS */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelBar} />
                <span className={styles.panelTitle}>Documents</span>
              </div>
              {docTypeSummary().map(d => (
                <div key={d.label} className={styles.docRow}>
                  <span className={styles.docLbl}>{d.label}</span>
                  <span className={styles.docVal}>{d.count}{d.label === 'Heads of agreement' && d.count > 0 ? ` version${d.count !== 1 ? 's' : ''}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </AppSidebar>
  )
}
