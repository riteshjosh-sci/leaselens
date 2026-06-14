import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './ReportView.module.css'

export default function ReportView() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [document, setDocument] = useState(null)
  const [negotiation, setNegotiation] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [logoUrl, setLogoUrl] = useState(null)
  const [allVersions, setAllVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [openClauses, setOpenClauses] = useState({})

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
          negotiations (
            id, property_name,
            workspaces ( id, name, client_name, logo_path )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (reportError || !reportData) { setError('Report not found.'); setLoading(false); return }

    setReport(reportData)
    setDocument(reportData.documents)
    setNegotiation(reportData.documents?.negotiations)

    const ws = reportData.documents?.negotiations?.workspaces
    setWorkspace(ws || null)

    if (ws?.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(ws.logo_path)
      setLogoUrl(urlData?.publicUrl || null)
    }

    if (reportData.documents?.negotiations?.id) {
      const { data: versions } = await supabase
        .from('documents')
        .select('id, version_number, filename, uploaded_at, overall_risk, reports(id)')
        .eq('negotiation_id', reportData.documents.negotiations.id)
        .order('version_number', { ascending: true })
      setAllVersions(versions || [])
    }

    // Auto-open first HIGH clause
    const clauses = reportData.report_json?.clauses || []
    const firstHigh = clauses.findIndex(c => c.danger === 'HIGH')
    if (firstHigh >= 0) setOpenClauses({ [firstHigh]: true })
    else if (clauses.length > 0) setOpenClauses({ 0: true })

    setLoading(false)
  }

  const handleDownloadPDF = async () => {
    if (!report) return
    const data = report.report_json
    let logoBase64 = null
    if (logoUrl) {
      try {
        const res = await fetch(logoUrl)
        const blob = await res.blob()
        logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })
      } catch (e) {}
    }

    const headerHTML = logoBase64
      ? `<div class="header branded">
           <div class="header-row">
             <img src="${logoBase64}" class="logo-img" alt="Logo" />
             <div class="header-divider"></div>
             <div class="brand-sub">Lease<em>Lens</em></div>
           </div>
           ${workspace?.client_name ? `<div class="client-name">${workspace.client_name}</div>` : ''}
           <div class="meta">${negotiation?.property_name || 'Document analysis'} · Version ${document?.version_number} · ${new Date(document?.uploaded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
         </div>`
      : `<div class="header">
           <div class="brand">Lease<em>Lens</em></div>
           <div class="meta">${negotiation?.property_name || 'Document analysis'} · Version ${document?.version_number} · ${new Date(document?.uploaded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
         </div>`

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>LeaseLens Report — ${document?.filename || 'Report'}</title>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; color: #1a1a18; font-size: 13px; line-height: 1.6; padding: 48px; max-width: 800px; margin: 0 auto; }
        .header { border-bottom: 2px solid #1a3a2a; padding-bottom: 24px; margin-bottom: 32px; }
        .brand { font-family: 'DM Serif Display', serif; font-size: 24px; color: #0f0f0d; margin-bottom: 8px; }
        .brand em { font-style: italic; color: #2a5c42; }
        .header.branded { border-bottom: 2px solid #1a3a2a; padding-bottom: 20px; margin-bottom: 32px; }
        .header-row { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }
        .logo-img { max-height: 48px; max-width: 180px; object-fit: contain; }
        .header-divider { width: 1px; height: 36px; background: #e2e0da; }
        .brand-sub { font-family: 'DM Serif Display', serif; font-size: 18px; color: #7a7a74; }
        .brand-sub em { font-style: italic; color: #2a5c42; }
        .client-name { font-size: 12px; font-weight: 600; color: #3a3a36; margin-bottom: 4px; }
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
        .dot-HIGH { background: #8b2020; } .dot-MEDIUM { background: #b8975a; } .dot-LOW { background: #1a5c30; }
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
      </style></head><body>
      ${headerHTML}
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
        </div>`).join('')}
      <div class="next-steps"><h2>Recommended next steps</h2><ol style="padding-left:18px;margin-top:12px">${(data.next_steps || []).map(s => `<li>${s}</li>`).join('')}</ol></div>
      <div class="disclaimer">DISCLAIMER: LeaseLens is an AI-powered analysis tool. It is not legal advice. Always consult a qualified solicitor before signing any retail lease or heads of agreement.</div>
      <div class="footer"><span>${workspace?.client_name ? `${workspace.client_name} · via ` : ''}LeaseLens · leaselens.au</span><span>Generated ${new Date().toLocaleDateString('en-AU')}</span></div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const RISK = {
    HIGH:   { dot: '#8b2020', pill: styles.pillHigh,   label: 'High priority' },
    MEDIUM: { dot: '#b8975a', pill: styles.pillMedium, label: 'Medium' },
    LOW:    { dot: '#1a5c30', pill: styles.pillLow,    label: 'Low' },
  }

  if (loading) return <div className={styles.loading}>Loading report…</div>

  if (error) return (
    <div className={styles.errorWrap}>
      <h2>{error}</h2>
      <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
    </div>
  )

  const data = report.report_json
  const clauses = data.clauses || []
  const filtered = filter === 'all' ? clauses : clauses.filter(c => c.danger === filter.toUpperCase())
  const highCount = clauses.filter(c => c.danger === 'HIGH').length
  const medCount  = clauses.filter(c => c.danger === 'MEDIUM').length
  const lowCount  = clauses.filter(c => c.danger === 'LOW').length

  return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main">
      <div className={styles.page}>
      {/* BREADCRUMB */}
      <div className={styles.crumb}>
        <button onClick={() => navigate('/dashboard')}>Dashboard</button>
        {negotiation?.workspace_id && <span>›</span>}
        {negotiation?.workspace_id && <button onClick={() => navigate(`/workspace/${negotiation.workspace_id}`)}>Workspace</button>}
        {negotiation && <span>›</span>}
        {negotiation && <button onClick={() => navigate(`/negotiation/${negotiation.id}`)}>{negotiation.property_name || 'Negotiation'}</button>}
        <span>›</span>
        <span>{stripTimestamp(document?.filename)}</span>
      </div>

      {/* DOCUMENT BAR */}
      <div className={styles.docBar}>
        <div className={styles.docBarInner}>
          <div className={styles.docId}>
            <div className={styles.fileIcon}>
              {document?.filename?.split('.').pop()?.toUpperCase() || 'DOC'}
            </div>
            <div>
              <h1 className={styles.docTitle}>
                {negotiation?.property_name || stripTimestamp(document?.filename)}
              </h1>
              <div className={styles.docMeta}>
                <span>Version {document?.version_number}</span>
                <span className={styles.sep}>·</span>
                <span>{formatDate(document?.uploaded_at)}</span>
                <span className={styles.sep}>·</span>
                <span className={styles.docRisk} data-risk={data.overall_risk}>
                  ● {data.overall_risk} RISK
                </span>
              </div>
            </div>
          </div>
          <div className={styles.docActions}>
            {allVersions.length >= 2 && (
              <button className={styles.btnOutline} onClick={() => navigate(`/compare/${negotiation?.id}`)}>
                Compare versions
              </button>
            )}
            <button className={styles.btnOutline} onClick={handleDownloadPDF}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v9m0 0L5 7m3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export PDF
            </button>
            <button className={styles.btnOutline} onClick={() => {
              const url = `${window.location.origin}/report/${id}`
              navigator.clipboard.writeText(url)
                .then(() => alert('Report link copied to clipboard'))
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M11 5a2 2 0 100-4 2 2 0 000 4zM5 10a2 2 0 100-4 2 2 0 000 4zm6 5a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M6.7 9l2.6 1.5M9.3 5.5L6.7 7" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Share
            </button>
            <button className={styles.btnInk} onClick={() => navigate('/analyser', { state: { negotiationId: negotiation?.id, workspaceId: workspace?.id } })}>
              Re-run analysis
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className={styles.appMain}>

        {/* CLAUSE LIST */}
        <div className={styles.briefing}>
          <div className={styles.briefingHead}>
            <h2 className={styles.briefingTitle}>
              Clause briefing <span>· {clauses.length} reviewed</span>
            </h2>
            <div className={styles.filterTabs}>
              {[
                { key: 'all',    label: 'All',    count: clauses.length },
                { key: 'high',   label: 'High',   count: highCount },
                { key: 'medium', label: 'Medium', count: medCount  },
                { key: 'low',    label: 'Low',    count: lowCount  },
              ].map(f => (
                <button
                  key={f.key}
                  className={`${styles.filterTab} ${filter === f.key ? styles.filterTabActive : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className={styles.filterCount}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.clauseList}>
            {filtered.map((c, i) => {
              const globalIdx = clauses.indexOf(c)
              const isOpen = !!openClauses[globalIdx]
              const risk = RISK[c.danger] || RISK.LOW
              return (
                <div
                  key={i}
                  className={`${styles.clauseItem} ${isOpen ? styles.clauseOpen : ''}`}
                  id={`clause-${globalIdx}`}
                >
                  <div
                    className={styles.clauseSummary}
                    onClick={() => setOpenClauses(prev => ({ ...prev, [globalIdx]: !prev[globalIdx] }))}
                  >
                    <span className={styles.prioDot} style={{ background: risk.dot }} />
                    <div className={styles.clauseTitles}>
                      {c.location && <div className={styles.clauseRef}>{c.location}</div>}
                      <div className={styles.clauseName}>{c.name}</div>
                    </div>
                    <span className={`${styles.pill} ${risk.pill}`}>{risk.label}</span>
                    <svg className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`} width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {isOpen && (
                    <div className={styles.clauseDetail}>
                      {c.quote && (
                        <div className={styles.docQuote}>
                          <span className={styles.qref}>Quoted from your document</span>
                          "{c.quote}"
                        </div>
                      )}
                      {c.risk && (
                        <div className={styles.analysisBlock}>
                          <div className={styles.blockHead}>What this means</div>
                          <p>{c.risk}</p>
                        </div>
                      )}
                      {c.counter && (
                        <div className={`${styles.analysisBlock} ${styles.counterBlock}`}>
                          <div className={`${styles.blockHead} ${styles.blockHeadAct}`}>Suggested counter</div>
                          <p>{c.counter}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* NEXT STEPS */}
          <div className={styles.nextSteps}>
            <h2>Recommended next steps</h2>
            <ol>{(data.next_steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>

          <div className={styles.disclaimer}>
            DISCLAIMER: LeaseLens is an AI-powered analysis tool. It is not legal advice. Always consult a qualified solicitor before signing any retail lease or heads of agreement.
          </div>
        </div>

        {/* SIDEBAR */}
        <div className={styles.summaryCol}>

          {/* At a glance */}
          <div className={styles.sCard}>
            <h3>At a glance</h3>
            <div className={styles.scoreRow}>
              <span className={styles.scoreNum}>{clauses.length}</span>
              <span className={styles.scoreOf}>clauses reviewed</span>
              <span className={styles.scoreLbl} data-risk={data.overall_risk}>{data.overall_risk}</span>
            </div>
            <div className={styles.meter}>
              {highCount > 0 && <span style={{ flex: highCount, background: 'var(--risk-h)' }} />}
              {medCount > 0  && <span style={{ flex: medCount,  background: 'var(--gold)' }} />}
              {lowCount > 0  && <span style={{ flex: lowCount,  background: 'var(--risk-l)' }} />}
            </div>
            <div className={styles.legend}>
              {[
                { label: 'High priority', count: highCount, color: 'var(--risk-h)' },
                { label: 'Medium',        count: medCount,  color: 'var(--gold)' },
                { label: 'Low / standard',count: lowCount,  color: 'var(--risk-l)' },
              ].map(l => (
                <div key={l.label} className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ background: l.color }} />
                  <span className={styles.legendName}>{l.label}</span>
                  <span className={styles.legendCount}>{l.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className={styles.sCard}>
            <h3>Summary</h3>
            <p className={styles.summaryText}>{data.summary}</p>
          </div>

          {/* Jump to */}
          <div className={styles.sCard}>
            <h3>Jump to clause</h3>
            <div className={styles.jumpList}>
              {clauses.map((c, i) => {
                const risk = RISK[c.danger] || RISK.LOW
                return (
                  <button key={i} className={styles.jumpItem} onClick={() => {
                    setOpenClauses(prev => ({ ...prev, [i]: true }))
                    setTimeout(() => {
                      const el = document.getElementById(`clause-${i}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 50)
                  }}>
                    <span className={styles.jumpDot} style={{ background: risk.dot }} />
                    <span className={styles.jumpName}>{c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Version history */}
          {allVersions.length > 1 && (
            <div className={styles.sCard}>
              <h3>Versions</h3>
              <div className={styles.versionList}>
                {allVersions.map(v => (
                  <div
                    key={v.id}
                    className={`${styles.versionRow} ${v.reports?.[0]?.id === id ? styles.versionActive : ''}`}
                    onClick={() => v.reports?.[0]?.id && navigate(`/report/${v.reports[0].id}`)}
                  >
                    <span className={styles.vNum}>v{v.version_number}</span>
                    <span className={styles.vDate}>{formatDate(v.uploaded_at)}</span>
                    {v.overall_risk && (
                      <span className={styles.vRisk} data-risk={v.overall_risk}>{v.overall_risk}</span>
                    )}
                  </div>
                ))}
              </div>
              <button className={styles.compareBtn} onClick={() => navigate(`/compare/${negotiation?.id}`)}>
                Compare versions →
              </button>
            </div>
          )}

          <p className={styles.sDisclaimer}>LeaseLens provides informational analysis to support negotiation and does not constitute legal advice.</p>
        </div>
      </div>
      </main>
    </div>
  )
}