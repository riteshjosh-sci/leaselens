import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ClauseCard from '../components/ClauseCard'
import styles from './SharedReport.module.css'

export default function SharedReport() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // loading | found | expired | notfound
  const [workspace, setWorkspace] = useState(null)
  const [reports, setReports] = useState([])    // all reports in workspace
  const [logoUrl, setLogoUrl] = useState(null)
  const [activeReport, setActiveReport] = useState(null)

  useEffect(() => { fetchByToken() }, [token])

  const fetchByToken = async () => {
    // Look up share token — no auth required
    const { data: tokenData, error } = await supabase
      .from('share_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !tokenData) { setState('notfound'); return }

    // Check expiry
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      setState('expired'); return
    }

    // Workspace-level share: fetch workspace + all its reports
    if (tokenData.workspace_id) {
      const [wsRes, reportsRes] = await Promise.all([
        supabase.from('workspaces').select('id, name, client_name, logo_path').eq('id', tokenData.workspace_id).single(),
        supabase.from('reports')
          .select(`
            id, created_at, report_json,
            documents (
              id, filename, version_number, uploaded_at, overall_risk,
              negotiations ( id, property_name, workspace_id )
            )
          `)
          .order('created_at', { ascending: false }),
      ])

      if (wsRes.error || !wsRes.data) { setState('notfound'); return }

      // Filter reports to this workspace only
      const wsId = tokenData.workspace_id
      const wsReports = (reportsRes.data || []).filter(r =>
        r.documents?.negotiations?.workspace_id === wsId
      )

      setWorkspace(wsRes.data)
      setReports(wsReports)
      if (wsReports.length > 0) setActiveReport(wsReports[0])

      if (wsRes.data.logo_path) {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(wsRes.data.logo_path)
        setLogoUrl(urlData?.publicUrl || null)
      }

      setState('found')
      return
    }

    // Report-level share
    if (tokenData.report_id) {
      const { data: reportData } = await supabase
        .from('reports')
        .select(`
          id, created_at, report_json,
          documents (
            id, filename, version_number, uploaded_at, overall_risk,
            negotiations (
              id, property_name,
              workspaces ( id, name, client_name, logo_path )
            )
          )
        `)
        .eq('id', tokenData.report_id)
        .single()

      if (!reportData) { setState('notfound'); return }

      const ws = reportData.documents?.negotiations?.workspaces
      setWorkspace(ws || null)
      setReports([reportData])
      setActiveReport(reportData)

      if (ws?.logo_path) {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(ws.logo_path)
        setLogoUrl(urlData?.publicUrl || null)
      }

      setState('found')
    }
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const riskClass = { HIGH: 'badge badge-high', MEDIUM: 'badge badge-medium', LOW: 'badge badge-low' }

  if (state === 'loading') return (
    <div className={styles.fullPage}>
      <div className={styles.loadingMsg}>Loading report…</div>
    </div>
  )

  if (state === 'notfound') return (
    <div className={styles.fullPage}>
      <div className={styles.errorBox}>
        <h2>Link not found</h2>
        <p>This share link doesn't exist or has been revoked.</p>
      </div>
    </div>
  )

  if (state === 'expired') return (
    <div className={styles.fullPage}>
      <div className={styles.errorBox}>
        <h2>Link expired</h2>
        <p>This share link has expired. Please ask your adviser to send a new one.</p>
      </div>
    </div>
  )

  const data = activeReport?.report_json
  const doc = activeReport?.documents

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className={styles.logo} />
            : <div className={styles.brandFallback}>Lease<em>Room</em></div>
          }
          {workspace && (
            <div className={styles.wsInfo}>
              <div className={styles.wsName}>{workspace.name}</div>
              {workspace.client_name && <div className={styles.wsClient}>{workspace.client_name}</div>}
            </div>
          )}
        </div>
        <div className={styles.headerRight}>
          <div className={styles.sharedBadge}>Shared report · Read only</div>
        </div>
      </div>

      <div className={styles.layout}>

        {/* SIDEBAR — report list if workspace share */}
        {reports.length > 1 && (
          <div className={styles.reportNav}>
            <div className={styles.navTitle}>Reports</div>
            {reports.map(r => (
              <div
                key={r.id}
                className={`${styles.navItem} ${r.id === activeReport?.id ? styles.navActive : ''}`}
                onClick={() => setActiveReport(r)}
              >
                <div className={styles.navProp}>{r.documents?.negotiations?.property_name || stripTimestamp(r.documents?.filename)}</div>
                <div className={styles.navMeta}>v{r.documents?.version_number} · {formatDate(r.created_at)}</div>
                {r.documents?.overall_risk && (
                  <span className={riskClass[r.documents.overall_risk]} style={{ fontSize: 10 }}>
                    {r.documents.overall_risk}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MAIN REPORT */}
        {activeReport && data && (
          <div className={styles.main}>
            <div className={styles.reportHeader}>
              <div className={styles.kicker}>Analysis report</div>
              <h1 className={styles.h1}>{doc?.negotiations?.property_name || stripTimestamp(doc?.filename)}</h1>
              <div className={styles.meta}>
                Version {doc?.version_number} · {stripTimestamp(doc?.filename)} · {formatDate(doc?.uploaded_at)}
              </div>
              <span className={riskClass[data.overall_risk] || 'badge badge-medium'} style={{ marginTop: 8, display: 'inline-block' }}>
                ● {data.overall_risk} Risk
              </span>
            </div>

            <div className={styles.summary}>{data.summary}</div>

            <div className={styles.statsRow}>
              {[
                { label: 'High risk', value: (data.clauses || []).filter(c => c.danger === 'HIGH').length, color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
                { label: 'Medium risk', value: (data.clauses || []).filter(c => c.danger === 'MEDIUM').length, color: 'var(--gold)', bg: 'var(--risk-m-bg)' },
                { label: 'Low risk', value: (data.clauses || []).filter(c => c.danger === 'LOW').length, color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
                { label: 'Total clauses', value: (data.clauses || []).length, color: 'var(--ink)', bg: 'var(--white)' },
              ].map(s => (
                <div key={s.label} className={styles.statCard} style={{ background: s.bg }}>
                  <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className={styles.sectionLabel}>Clause-by-clause findings</div>
            <div className={styles.clauses}>
              {(data.clauses || []).map((c, i) => <ClauseCard key={i} clause={c} />)}
            </div>

            <div className={styles.nextSteps}>
              <h2>Recommended next steps</h2>
              <ol>{(data.next_steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>

            <div className={styles.disclaimer}>
              DISCLAIMER: LeaseRoom is an AI-powered analysis tool. It is not legal advice. Always consult a qualified solicitor before signing any retail lease or heads of agreement.
            </div>

            <div className={styles.footer}>
              <span>LeaseRoom · leaseroom.com.au</span>
              <span>Generated {formatDate(activeReport.created_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
