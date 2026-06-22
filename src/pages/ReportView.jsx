import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/Footer'
import Nav from '../components/Nav'
import styles from './ReportView.module.css'

export default function ReportView() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [report, setReport]           = useState(null)
  const [document, setDocument]       = useState(null)
  const [negotiation, setNegotiation] = useState(null)
  const [workspace, setWorkspace]     = useState(null)
  const [leaseData, setLeaseData]     = useState(null)
  const [logoUrl, setLogoUrl]         = useState(null)
  const [allVersions, setAllVersions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [filter, setFilter]           = useState('all')
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

    // Fetch lease_data for this document
    if (reportData.documents?.id) {
      const { data: ld } = await supabase
        .from('lease_data')
        .select('*')
        .eq('document_id', reportData.documents.id)
        .single()
      setLeaseData(ld || null)
    }

    if (reportData.documents?.negotiations?.id) {
      const { data: versions } = await supabase
        .from('documents')
        .select('id, version_number, filename, uploaded_at, overall_risk, reports(id)')
        .eq('negotiation_id', reportData.documents.negotiations.id)
        .order('version_number', { ascending: true })
      setAllVersions(versions || [])
    }

    const clauses = reportData.report_json?.clauses || []
    const firstHigh = clauses.findIndex(c => c.danger === 'HIGH')
    if (firstHigh >= 0) setOpenClauses({ [firstHigh]: true })
    else if (clauses.length > 0) setOpenClauses({ 0: true })

    setLoading(false)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const formatMoney = (n) => n ? `$${Number(n).toLocaleString()}` : null
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  const RISK = {
    HIGH:   { dot: 'var(--accent)',  pill: styles.pillHigh,   label: 'High priority' },
    MEDIUM: { dot: 'var(--risk-m)', pill: styles.pillMedium, label: 'Medium' },
    LOW:    { dot: 'var(--risk-l)', pill: styles.pillLow,    label: 'Low' },
  }

  // Determine if lease or HOA
  const isHoaFilename = document?.filename?.toLowerCase().includes('hoa')
  const docType = leaseData?.document_type || (isHoaFilename ? 'HOA' : 'Lease')
  // HOA only if explicitly set to HOA — everything else (Lease, Agreement for Lease, null) is treated as lease
  const isLease = docType?.toUpperCase() !== 'HOA'

  // Commercial terms rows
  const commercialRows = isLease ? [
    { label: 'Lease term',        value: leaseData?.term_years ? `${leaseData.term_years} years${leaseData.option_terms ? ` + ${leaseData.option_terms} option` : ''}` : null },
    { label: 'Commencement',      value: leaseData?.commencement_date ? formatDate(leaseData.commencement_date) : null },
    { label: 'Base rent (p.a.)',  value: formatMoney(leaseData?.base_rent_annual) },
    { label: 'Rent per sqm',      value: leaseData?.base_rent_psm ? `${formatMoney(leaseData.base_rent_psm)}/sqm` : null },
    { label: 'Tenancy size',      value: leaseData?.tenancy_size_sqm ? `${leaseData.tenancy_size_sqm} sqm` : null },
    { label: 'Outgoings (p.a.)',  value: formatMoney(leaseData?.outgoings_annual) },
    { label: 'Total deal value',  value: formatMoney(leaseData?.total_annual_deal_value) },
    { label: 'Rent review',       value: leaseData?.rent_review_type ? `${leaseData.rent_review_type.toUpperCase()}${leaseData.rent_review_rate ? ` ${leaseData.rent_review_rate}%` : ''}` : null },
    { label: 'Bank guarantee',    value: leaseData?.bank_guarantee_months ? `${leaseData.bank_guarantee_months} months` : null },
    { label: 'Fit-out contrib.',  value: formatMoney(leaseData?.fitout_contribution) },
    { label: 'Permitted use',     value: leaseData?.permitted_use },
    { label: 'State',             value: leaseData?.state },
  ].filter(r => r.value) : [
    { label: 'Document type',    value: docType },
    { label: 'Term',             value: leaseData?.term_years ? `${leaseData.term_years} years` : null },
    { label: 'Base rent (p.a.)', value: formatMoney(leaseData?.base_rent_annual) },
    { label: 'Bank guarantee',   value: leaseData?.bank_guarantee_months ? `${leaseData.bank_guarantee_months} months` : null },
    { label: 'State',            value: leaseData?.state },
  ].filter(r => r.value)

  const handleDownloadPDF = async () => {
    if (!report) return
    const data = report.report_json
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>LeaseLens Report — ${document?.filename || 'Report'}</title>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'IBM Plex Sans', sans-serif; color: #1C1916; font-size: 13px; line-height: 1.6; padding: 48px; max-width: 800px; margin: 0 auto; }
        .header { border-bottom: 2px solid #1C1916; padding-bottom: 20px; margin-bottom: 28px; }
        .brand { font-size: 22px; font-weight: 700; color: #1C1916; margin-bottom: 6px; }
        .brand em { font-style: normal; color: #2C50D6; }
        .meta { font-size: 11px; color: #8C8579; }
        .commercials { background: #F7F7F8; border: 1px solid rgba(28,25,22,0.1); border-radius: 8px; padding: 18px; margin-bottom: 24px; }
        .commercials-title { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8C8579; margin-bottom: 14px; }
        .commercials-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .com-item .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #8C8579; margin-bottom: 3px; }
        .com-item .val { font-size: 14px; font-weight: 600; color: #1C1916; }
        .summary { background: #f0f5f2; border-left: 3px solid #2C50D6; padding: 14px 18px; margin-bottom: 24px; font-size: 14px; line-height: 1.7; }
        .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 20px; }
        .risk-HIGH { background: rgba(44,80,214,0.1); color: #1E3AA8; }
        .risk-MEDIUM { background: rgba(194,146,43,0.14); color: #8a6312; }
        .risk-LOW { background: rgba(94,140,106,0.16); color: #3f6b4e; }
        h2 { font-size: 18px; font-weight: 600; margin: 28px 0 14px; padding-bottom: 8px; border-bottom: 1px solid rgba(28,25,22,0.1); }
        .clause { border: 1px solid rgba(28,25,22,0.1); border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
        .clause-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #F7F7F8; }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-HIGH { background: #2C50D6; } .dot-MEDIUM { background: #C2922B; } .dot-LOW { background: #5E8C6A; }
        .clause-name { font-weight: 600; font-size: 14px; flex: 1; }
        .clause-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
        .clause-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #8C8579; margin-bottom: 4px; }
        .clause-quote { background: #F7F7F8; border-left: 3px solid #C2922B; padding: 10px 14px; font-size: 12px; color: #4B463E; font-style: italic; }
        .clause-counter { background: rgba(44,80,214,0.06); border-left: 3px solid #2C50D6; padding: 10px 14px; font-size: 12px; color: #1E3AA8; }
        .next-steps { background: #1C1916; color: white; padding: 22px; border-radius: 8px; margin-top: 28px; }
        .next-steps h2 { color: white; border-color: rgba(255,255,255,0.1); }
        .next-steps li { color: rgba(255,255,255,0.8); margin-bottom: 8px; }
        .disclaimer { margin-top: 28px; padding: 12px 16px; border: 1px solid rgba(28,25,22,0.1); border-radius: 6px; font-size: 11px; color: #8C8579; }
        .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid rgba(28,25,22,0.1); font-size: 11px; color: #8C8579; display: flex; justify-content: space-between; }
      </style></head><body>
      <div class="header">
        <div class="brand">Lease<em>Lens</em></div>
        <div class="meta">${negotiation?.property_name || 'Document analysis'} · v${document?.version_number} · ${formatDate(document?.uploaded_at)}</div>
      </div>
      <span class="risk-badge risk-${data.overall_risk}">● ${data.overall_risk} RISK</span>
      ${commercialRows.length > 0 ? `
      <div class="commercials">
        <div class="commercials-title">${isLease ? 'Lease' : 'HOA'} — Commercial Terms</div>
        <div class="commercials-grid">
          ${commercialRows.map(r => `<div class="com-item"><div class="lbl">${r.label}</div><div class="val">${r.value}</div></div>`).join('')}
        </div>
      </div>` : ''}
      <div class="summary">${data.summary}</div>
      <h2>Clause-by-clause analysis</h2>
      ${(data.clauses || []).map(c => `
        <div class="clause">
          <div class="clause-header">
            <div class="dot dot-${c.danger}"></div>
            <div class="clause-name">${c.name}</div>
          </div>
          <div class="clause-body">
            ${c.quote   ? `<div><div class="clause-label">Clause wording</div><div class="clause-quote">"${c.quote}"</div></div>` : ''}
            ${c.risk    ? `<div><div class="clause-label">What this means</div><div>${c.risk}</div></div>` : ''}
            ${c.counter ? `<div><div class="clause-label">Suggested counter</div><div class="clause-counter">${c.counter}</div></div>` : ''}
          </div>
        </div>`).join('')}
      <div class="next-steps"><h2>Recommended next steps</h2><ol style="padding-left:18px;margin-top:12px">${(data.next_steps || []).map(s => `<li>${s}</li>`).join('')}</ol></div>
      <div class="disclaimer">DISCLAIMER: LeaseLens is an AI-powered analysis tool. It is not legal advice. Always consult a qualified solicitor before signing any retail lease or heads of agreement.</div>
      <div class="footer"><span>${workspace?.client_name ? `${workspace.client_name} · ` : ''}LeaseLens · leaselens.au</span><span>Generated ${formatDate(new Date())}</span></div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  if (loading) return <><Nav /><div className={styles.loading}>Loading report…</div></>

  if (error) return (
    <><Nav />
    <div className={styles.errorWrap}>
      <h2>{error}</h2>
      <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
    </div></>
  )

  const data     = report.report_json
  const clauses  = data.clauses || []
  const filtered = filter === 'all' ? clauses : clauses.filter(c => c.danger === filter.toUpperCase())
  const highCount = clauses.filter(c => c.danger === 'HIGH').length
  const medCount  = clauses.filter(c => c.danger === 'MEDIUM').length
  const lowCount  = clauses.filter(c => c.danger === 'LOW').length

  return (
    <div className={styles.page}>
      <Nav />

      {/* BREADCRUMB */}
      <div className={styles.crumb}>
        <button onClick={() => navigate('/dashboard')}>Dashboard</button>
        {workspace?.id && <><span>›</span><button onClick={() => navigate(`/workspace/${workspace.id}`)}>Workspace</button></>}
        {negotiation && <><span>›</span><button onClick={() => navigate(`/negotiation/${negotiation.id}`)}>{negotiation.property_name || 'Negotiation'}</button></>}
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
            <div className={styles.docTitleWrap}>
              <h1 className={styles.docTitle}>
                {negotiation?.property_name || stripTimestamp(document?.filename)}
                {document?.version_number && (
                  <span className={styles.docVersionBadge}>V{document.version_number}</span>
                )}
              </h1>
              <div className={styles.docMeta}>
                <span>Version {document?.version_number}</span>
                <span className={styles.sep}>·</span>
                <span>{formatDate(document?.uploaded_at)}</span>
                <span className={styles.sep}>·</span>
                <span className={`${styles.docRisk} ${styles[`docRisk${data.overall_risk}`]}`}>
                  ● {data.overall_risk} RISK
                </span>
              </div>
            </div>
          </div>
          <div className={styles.docActions}>
            {negotiation?.id && (
              <button className={styles.btnOutline} onClick={() => navigate(`/negotiation/${negotiation.id}#review`)}>
                Review clauses
              </button>
            )}
            {allVersions.length >= 2 && (
              <button className={styles.btnOutline} onClick={() => navigate(`/negotiation/${negotiation?.id}#compare`)}>
                Compare versions
              </button>
            )}
            <button className={styles.btnOutline} onClick={handleDownloadPDF}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v9m0 0L5 7m3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export PDF
            </button>
            <button className={styles.btnInk} onClick={() => navigate('/analyser', { state: { negotiationId: negotiation?.id, workspaceId: workspace?.id, prefill: { asset_class: negotiation?.asset_class || 'retail' } } })}>
              + Add version
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className={styles.appMain}>
        <div className={styles.briefing}>

          {/* COMMERCIALS TABLE */}
          {commercialRows.length > 0 && (
            <div className={styles.commercials}>
              <div className={styles.commercialsKicker}>
                {isLease ? 'Lease' : 'Heads of Agreement'} · Commercial terms
              </div>
              <div className={styles.commercialsGrid}>
                {commercialRows.map(r => (
                  <div key={r.label} className={styles.comItem}>
                    <div className={styles.comLabel}>{r.label}</div>
                    <div className={styles.comValue}>{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUMMARY */}
          <div className={styles.reportSummary}>{data.summary}</div>

          {/* HOA CONFIRMATION */}
          {data.hoa_confirmation?.length > 0 && (
            <div className={styles.hoaConfirm}>
              <div className={styles.hoaConfirmHead}>
                <div className={styles.hoaConfirmKicker}>HOA Confirmation</div>
                <div className={styles.hoaConfirmSub}>Checking that terms agreed in the Heads of Agreement are carried through in this Lease</div>
              </div>
              <div className={styles.hoaTable}>
                <div className={styles.hoaTableHead}>
                  <div>Term / Clause</div>
                  <div>HOA</div>
                  <div>Lease</div>
                  <div>Status</div>
                </div>
                {data.hoa_confirmation.map((row, i) => (
                  <div key={i} className={styles.hoaRow}>
                    <div className={styles.hoaTerm}>{row.term}</div>
                    <div className={styles.hoaVal}>{row.hoa_value || '—'}</div>
                    <div className={styles.hoaVal}>{row.lease_value || '—'}</div>
                    <div className={styles.hoaStatusCell}>
                      <span className={`${styles.hoaStatusPill} ${
                        row.status === 'confirmed' ? styles.hoaStatusConfirmed :
                        row.status === 'changed'   ? styles.hoaStatusChanged :
                                                     styles.hoaStatusMissing
                      }`}>
                        {row.status === 'confirmed' ? '✓ Confirmed' :
                         row.status === 'changed'   ? '⚠ Changed'  : '✕ Missing'}
                      </span>
                      {row.note && <div className={styles.hoaNote}>{row.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CLAUSE LIST */}
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
              const isOpen    = !!openClauses[globalIdx]
              const risk      = RISK[c.danger] || RISK.LOW
              return (
                <div key={i} className={`${styles.clauseItem} ${isOpen ? styles.clauseOpen : ''}`} id={`clause-${globalIdx}`}>
                  <div className={styles.clauseSummary}
                    onClick={() => setOpenClauses(prev => ({ ...prev, [globalIdx]: !prev[globalIdx] }))}>
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
          <div className={styles.sCard}>
            <h3>At a glance</h3>
            <div className={styles.scoreRow}>
              <span className={styles.scoreNum}>{clauses.length}</span>
              <span className={styles.scoreOf}>clauses reviewed</span>
              <span className={`${styles.scoreLbl} ${styles[`scoreLbl${data.overall_risk}`]}`}>{data.overall_risk}</span>
            </div>
            <div className={styles.meter}>
              {highCount > 0 && <span style={{ flex: highCount, background: 'var(--accent)' }} />}
              {medCount  > 0 && <span style={{ flex: medCount,  background: 'var(--risk-m)' }} />}
              {lowCount  > 0 && <span style={{ flex: lowCount,  background: 'var(--risk-l)' }} />}
            </div>
            <div className={styles.legend}>
              {[
                { label: 'High priority',  count: highCount, color: 'var(--accent)' },
                { label: 'Medium',         count: medCount,  color: 'var(--risk-m)' },
                { label: 'Low / standard', count: lowCount,  color: 'var(--risk-l)' },
              ].map(l => (
                <div key={l.label} className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ background: l.color }} />
                  <span className={styles.legendName}>{l.label}</span>
                  <span className={styles.legendCount}>{l.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.sCard}>
            <h3>Summary</h3>
            <p className={styles.summaryText}>{data.summary}</p>
          </div>

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

          {allVersions.length > 1 && (
            <div className={styles.sCard}>
              <h3>Versions</h3>
              <div className={styles.versionList}>
                {allVersions.map(v => (
                  <div key={v.id}
                    className={`${styles.versionRow} ${v.reports?.[0]?.id === id ? styles.versionActive : ''}`}
                    onClick={() => v.reports?.[0]?.id && navigate(`/report/${v.reports[0].id}`)}>
                    <span className={styles.vNum}>v{v.version_number}</span>
                    <span className={styles.vDate}>{formatDate(v.uploaded_at)}</span>
                    {v.overall_risk && <span className={styles.vRisk}>{v.overall_risk}</span>}
                  </div>
                ))}
              </div>
              <button className={styles.compareBtn} onClick={() => navigate(`/negotiation/${negotiation?.id}#compare`)}>
                Compare versions →
              </button>
            </div>
          )}

          <p className={styles.sDisclaimer}>LeaseLens provides informational analysis to support negotiation and does not constitute legal advice.</p>
        </div>
      </div>
    </div>
  )
}
