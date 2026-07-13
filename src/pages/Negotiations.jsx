import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './Negotiations.module.css'

export default function Negotiations() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!user) return; fetchAll() }, [user])

  const fetchAll = async () => {
    const { data } = await supabase
      .from('workspaces')
      .select(`
        id, name, client_name,
        negotiations (
          id, status, lifecycle, property_name, created_at, tenant_name, premises_address,
          documents ( id, uploaded_at )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_deleted', false)

    const CLAUSE_WORDS = ['takes a lease', 'landlord', 'herein', 'pursuant', 'thereof', 'together with', 'non-exclusive', 'the term']
    const isClause = v => !v || v.length > 150 || CLAUSE_WORDS.some(w => v.toLowerCase().includes(w))

    const renameUpdates = []
    for (const ws of (data || [])) {
      if ((ws.client_name || ws.name) !== 'New workspace') continue
      const negWithData = (ws.negotiations || []).find(n => n.tenant_name || n.premises_address)
      if (!negWithData) continue
      const tenant  = !isClause(negWithData.tenant_name)      ? negWithData.tenant_name      : null
      const address = !isClause(negWithData.premises_address) ? negWithData.premises_address : null
      const friendly = tenant || address
      if (friendly) {
        ws.name = friendly
        renameUpdates.push(supabase.from('workspaces').update({ name: friendly }).eq('id', ws.id))
      }
    }
    if (renameUpdates.length) await Promise.all(renameUpdates)

    const flat = (data || []).flatMap(ws =>
      (ws.negotiations || []).map(n => ({
        ...n,
        wsName: ws.client_name || ws.name,
        wsId: ws.id,
        docCount: n.documents?.length || 0,
        latest: (n.documents || []).reduce((max, d) => !max || new Date(d.uploaded_at) > new Date(max) ? d.uploaded_at : max, null) || n.created_at,
      }))
    )
    flat.sort((a, b) => new Date(b.latest) - new Date(a.latest))
    setRows(flat)
    setLoading(false)
  }

  const cleanName = (n) =>
    (n.property_name || 'Unnamed negotiation').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')

  const formatDate = d =>
    new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const statusChip = (lc) => {
    if (lc === 'agreed') return { label: 'Agreed', cls: styles.chipDone }
    if (lc === 'awaiting') return { label: 'Awaiting landlord', cls: styles.chipWait }
    if (lc === 'sent') return { label: 'Sent to agent', cls: styles.chipWait }
    if (lc === 'counter_prepared') return { label: 'Counter prepared', cls: styles.chipCounter }
    return { label: 'In review', cls: styles.chipNeutral }
  }

  if (loading) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  return (
    <AppSidebar>
      <div className={styles.page}>
        <h1 className={styles.h1}>Negotiations</h1>
        <div className={styles.summaryLine}>Every active and finalised round across all your properties.</div>

        {rows.length === 0 ? (
          <div className={styles.empty}>
            No negotiations yet.
            <button className={styles.linkBtn} onClick={() => navigate('/analyser')}>Analyse a document →</button>
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tHead}>
              <span>Negotiation</span>
              <span>Property</span>
              <span>Status</span>
              <span>Updated</span>
            </div>
            {rows.map(n => {
              const chip = statusChip(n.lifecycle)
              return (
                <div key={n.id} className={styles.tRow} onClick={() => navigate(`/negotiation/${n.id}`)}>
                  <div className={styles.negCell}>
                    <div className={styles.negName}>{cleanName(n)}</div>
                    <div className={styles.negMeta}>{n.docCount} document{n.docCount !== 1 ? 's' : ''}</div>
                  </div>
                  <span className={styles.propCell}>{n.wsName}</span>
                  <span className={`${styles.chip} ${chip.cls}`}><span className={styles.chipDot} />{chip.label}</span>
                  <span className={styles.dateCell}>{formatDate(n.latest)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppSidebar>
  )
}
