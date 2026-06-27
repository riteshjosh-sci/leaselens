import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AdminNav from '../components/AdminNav'
import ClauseCard from '../components/ClauseCard'
import styles from './AdminReportView.module.css'

export default function AdminReportView() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    fetchReport()
  }, [documentId])

  const fetchReport = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/admin-data?resource=report-detail&documentId=${documentId}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    })
    if (!res.ok) { setLoading(false); return }
    const { document: doc, report: reportData } = await res.json()

    if (!doc) { setLoading(false); return }
    setDocument(doc)
    if (reportData) setReport(reportData.report_json)
    setLoading(false)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const riskBadge = (risk) => {
    if (!risk) return null
    const map = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' }
    return <span className={`badge ${map[risk]}`}>{risk}</span>
  }

  if (loading) return (
    <div className={styles.layout}>
      <AdminNav activeTab="reports" setTab={() => {}} />
      <main className={styles.main}><div className={styles.loading}>Loading report...</div></main>
    </div>
  )

  if (!report) return (
    <div className={styles.layout}>
      <AdminNav activeTab="reports" setTab={() => {}} />
      <main className={styles.main}>
        <div className={styles.loading}>
          <p>No report found for this document.</p>
          <button className="btn-primary" onClick={() => navigate('/admin')}>Back to admin</button>
        </div>
      </main>
    </div>
  )

  return (
    <div className={styles.layout}>
      <AdminNav activeTab="reports" setTab={() => navigate('/admin')} />
      <main className={styles.main}>
        <div className={styles.content}>
          <button className={styles.back} onClick={() => navigate('/admin')}>← Back to admin</button>

          <div className={styles.header}>
            <div>
              <div className={styles.kicker}>Admin · Report view</div>
              <h1 className={styles.h1}>{document?.negotiations?.property_name || document?.filename}</h1>
              <div className={styles.meta}>
                {document?.filename} · v{document?.version_number} · {formatDate(document?.uploaded_at)}
              </div>
            </div>
            {riskBadge(report.overall_risk)}
          </div>

          <div className={styles.summary}>{report.summary}</div>

          <div className={styles.statsRow}>
            {[
              { label: 'High risk', value: (report.clauses||[]).filter(c=>c.danger==='HIGH').length, color: 'var(--risk-h)', bg: 'var(--risk-h-bg)' },
              { label: 'Medium risk', value: (report.clauses||[]).filter(c=>c.danger==='MEDIUM').length, color: 'var(--gold)', bg: 'var(--risk-m-bg)' },
              { label: 'Low risk', value: (report.clauses||[]).filter(c=>c.danger==='LOW').length, color: 'var(--risk-l)', bg: 'var(--risk-l-bg)' },
              { label: 'Total clauses', value: (report.clauses||[]).length, color: 'var(--ink)', bg: 'var(--white)' },
            ].map(s => (
              <div key={s.label} className={styles.statCard} style={{ background: s.bg }}>
                <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.sectionLabel}>Clause-by-clause findings</div>
          <div className={styles.clauses}>
            {(report.clauses || []).map((c, i) => <ClauseCard key={i} clause={c} />)}
          </div>

          {report.next_steps?.length > 0 && (
            <div className={styles.nextSteps}>
              <h3>Recommended next steps</h3>
              <ol>{report.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
