import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import ClauseCard from '../components/ClauseCard'
import styles from './ReportView.module.css'

export default function ReportView() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [document, setDocument] = useState(null)
  const [negotiation, setNegotiation] = useState(null)
  const [allVersions, setAllVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchReport()
  }, [id, user])

  const fetchReport = async () => {
    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .select(`
        id, created_at, report_json,
        documents (
          id, filename, version_number, uploaded_at, overall_risk,
          negotiations ( id, property_name )
        )
      `)
      .eq('id', id)
      .single()

    if (reportError || !reportData) {
      setError('Report not found.')
      setLoading(false)
      return
    }

    setReport(reportData)
    setDocument(reportData.documents)
    setNegotiation(reportData.documents?.negotiations)

    // Fetch all versions for this negotiation
    if (reportData.documents?.negotiations?.id) {
      const { data: versions } = await supabase
        .from('documents')
        .select('id, version_number, filename, uploaded_at, overall_risk, reports(id)')
        .eq('negotiation_id', reportData.documents.negotiations.id)
        .order('version_number', { ascending: true })
      setAllVersions(versions || [])
    }

    setLoading(false)
  }

  const handleDownloadPDF = () => {
    if (!report) return
    const data = report.report_json
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>LeaseLens Report — ${document?.filename || 'Report'}</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', sans-serif; color: #1a1a18; font-size: 13px; line-height: 1.6; padding: 48px; max-width: 800px; margin: 0 auto; }
          .header { border-bottom: 2px solid #1a3a2a; padding-bottom: 24px; margin-bottom: 32px; }
          .brand { font-family: 'DM Serif Display', serif; font-size: 24px; color: #0f0f0d; margin-bottom: 8px; }
          .brand em { font-style: italic; color: #2a5c42; }
          .meta { font-size: 11px; color: #7a7a74; }
          .summary { background: #f0f5f2; border-left: 3px solid #1a3a2a; padding: 16px 20px; margin-bottom: 32px; font-size: 14px; color: #3a3a36; line-height: 1.75; }
          .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 2px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; margin-bottom: 24px; }
          .risk-HIGH { background: #fdf2f2; color: #8b2020; }
          .risk-MEDIUM { background: #fdf8f0; color: #7a5010; }
          .risk-LOW { background: #f0f7f3; color: #1a5c30; }
          h2 { font-family: 'DM Serif Display', serif; font-size: 20px; font-weight: 400; color: #0f0f0d; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e0da; }
          .clause { border: 1px solid #e2e0da; border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
          .clause-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f7fbf8; }
          .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
          .dot-HIGH { background: #8b2020; }
          .dot-MEDIUM { background: #b8975a; }
          .dot-LOW { background: #1a5c30; }
          .clause-name { font-weight: 500; font-size: 14px; flex: 1; }
          .clause-body { padding: 16px; }
          .clause-section { margin-bottom: 12px; }
          .clause-label { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #7a7a74; margin-bottom: 4px; }
          .clause-quote { background: #f5f0e8; border-left: 3px solid #b8975a; padding: 10px 14px; font-size: 12px; color: #7a5010; font-style: italic; }
          .clause-counter { background: #f0f7f3; border-left: 3px solid #1a5c30; padding: 10px 14px; font-size: 12px; color: #1a5c30; }
          .next-steps { background: #0f0f0d; color: white; padding: 24px; border-radius: 2px; margin-top: 32px; }
          .next-steps h2 { color: white; border-color: rgba(255,255,255,0.1); }
          .next-steps li { color: rgba(255,255,255,0.8); margin-bottom: 8px; font-size: 13px; }
          .disclaimer { margin-top: 32px; padding: 12px 16px; border: 1px solid #e2e0da; font-size: 11px; color: #7a7a74; font-family: monospace; }
          .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e0da; font-size: 11px; color: #7a7a74; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">Lease<em>Lens</em></div>
          <div class="meta">
            ${negotiation?.property_name || 'Document analysis'} · 
            Version ${document?.version_number} · 
            ${new Date(document?.uploaded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div class="risk-badge risk-${data.overall_risk}">● ${data.overall_risk} RISK</div>
        <div class="summary">${data.summary}</div>

        <h2>Clause-by-clause analysis</h2>
        ${(data.clauses || []).map(c => `
          <div class="clause">
            <div class="clause-header">
              <div class="dot dot-${c.danger}"></div>
              <div class="clause-name">${c.name}</div>
              <span class="risk-badge risk-${c.danger}" style="margin:0">${c.danger}</span>
            </div>
            <div class="clause-body">
              ${c.location ? `<div class="clause-section"><div class="clause-label">Location</div><div>${c.location}</div></div>` : ''}
              ${c.quote ? `<div class="clause-section"><div class="clause-label">Clause wording</div><div class="clause-quote">"${c.quote}"</div></div>` : ''}
              ${c.risk ? `<div class="clause-section"><div class="clause-label">What this means</div><div>${c.risk}</div></div>` : ''}
              ${c.counter ? `<div class="clause-section"><div class="clause-label">Suggested response</div><div class="clause-counter">${c.counter}</div></div>` : ''}
            </div>
          </div>
        `).join('')}

        <div class="next-steps">
          <h2>Recommended next steps</h2>
          <ol style="padding-left:18px;margin-top:12px">
            ${(data.next_steps || []).map(s => `<li>${s}</li>`).join('')}
          </ol>
        </div>

        <div class="disclaimer">
          DISCLAIMER: LeaseLens is an AI-powered analysis tool. It is not legal advice. Always consult a qualified solicitor before signing any retail lease or heads of agreement.
        </div>

        <div class="footer">
          <span>LeaseLens · leaselens.au</span>
          <span>Generated ${new Date().toLocaleDateString('en-AU')}</span>
        </div>
      </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const riskClass = { HIGH: 'badge badge-high', MEDIUM: 'badge badge-medium', LOW: 'badge badge-low' }

  if (loading) return (
    <>
      <Nav />
      <div className={styles.loading}>Loading report...</div>
    </>
  )

  if (error) return (
    <>
      <Nav />
      <div className={styles.errorWrap}>
        <h2>{error}</h2>
        <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
      </div>
    </>
  )

  const data = report.report_json

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* BREADCRUMB */}
        <div className={styles.breadcrumb}>
          <button onClick={() => navigate('/dashboard')}>← Dashboard</button>
          {negotiation && <><span>/</span><span>{negotiation.property_name}</span></>}
          <span>/</span>
          <span>v{document?.version_number}</span>
        </div>

        <div className={styles.layout}>
          {/* MAIN CONTENT */}
          <div className={styles.main}>
            <div className={styles.reportHeader}>
              <div>
                <div className={styles.kicker}>Analysis report</div>
                <h1 className={styles.h1}>{negotiation?.property_name || document?.filename}</h1>
                <div className={styles.meta}>
                  Version {document?.version_number} · {document?.filename} · {formatDate(document?.uploaded_at)}
                </div>
              </div>
              <div className={styles.headerActions}>
                <span className={riskClass[data.overall_risk] || 'badge badge-medium'}>
                  ● {data.overall_risk} Risk
                </span>
                <button className="btn-primary" onClick={handleDownloadPDF}>
                  ↓ Download PDF
                </button>
              </div>
            </div>

            {/* SUMMARY */}
            <div className={styles.summary}>{data.summary}</div>

            {/* STATS ROW */}
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

            {/* CLAUSES */}
            <div className={styles.sectionLabel}>Clause-by-clause findings</div>
            <div className={styles.clauses}>
              {(data.clauses || []).map((c, i) => <ClauseCard key={i} clause={c} />)}
            </div>

            {/* NEXT STEPS */}
            <div className={styles.nextSteps}>
              <h2>Recommended next steps</h2>
              <ol>
                {(data.next_steps || []).map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>

            <div className={styles.disclaimer}>
              DISCLAIMER: LeaseLens is an AI-powered analysis tool. It is not legal advice. Always consult a qualified solicitor before signing any retail lease or heads of agreement.
            </div>
          </div>

          {/* SIDEBAR */}
          <div className={styles.sidebar}>
            {/* Version history */}
            {allVersions.length > 1 && (
              <div className={styles.sideCard}>
                <div className={styles.sideTitle}>Version history</div>
                <div className={styles.versionList}>
                  {allVersions.map(v => (
                    <div
                      key={v.id}
                      className={`${styles.versionRow} ${v.reports?.[0]?.id === id ? styles.versionActive : ''}`}
                      onClick={() => v.reports?.[0]?.id && navigate(`/report/${v.reports[0].id}`)}
                    >
                      <div className={styles.versionNum}>v{v.version_number}</div>
                      <div className={styles.versionInfo}>
                        <div className={styles.versionName}>{v.filename}</div>
                        <div className={styles.versionDate}>{formatDate(v.uploaded_at)}</div>
                      </div>
                      {v.overall_risk && (
                        <span className={`badge ${riskClass[v.overall_risk]?.split(' ')[1] || 'badge-medium'}`} style={{ fontSize: 10 }}>
                          {v.overall_risk}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {allVersions.length >= 2 && (
                  <button
                    className={styles.compareBtn}
                    onClick={() => navigate(`/compare/${negotiation?.id}`)}
                  >
                    Compare versions →
                  </button>
                )}
              </div>
            )}

            {/* Document info */}
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>Document details</div>
              <div className={styles.infoList}>
                <div className={styles.infoRow}><span>File</span><span>{document?.filename}</span></div>
                <div className={styles.infoRow}><span>Version</span><span>v{document?.version_number}</span></div>
                <div className={styles.infoRow}><span>Uploaded</span><span>{formatDate(document?.uploaded_at)}</span></div>
                <div className={styles.infoRow}><span>Risk rating</span><span className={riskClass[data.overall_risk]}>{data.overall_risk}</span></div>
                <div className={styles.infoRow}><span>Clauses found</span><span>{data.clauses?.length || 0}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
