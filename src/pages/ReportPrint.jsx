import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './ReportPrint.module.css'

export default function ReportPrint() {
  const { id } = useParams()
  const [report, setReport]     = useState(null)
  const [document, setDocument] = useState(null)
  const [neg, setNeg]           = useState(null)
  const [ws, setWs]             = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => { fetchReport() }, [id])

  const fetchReport = async () => {
    const { data: rpt } = await supabase
      .from('reports')
      .select(`*, documents ( id, filename, version_number, uploaded_at, overall_risk,
        negotiations ( id, property_name, workspace_id,
          workspaces ( id, name, client_name, logo_path ) ) )`)
      .eq('id', id).single()

    if (!rpt) return
    setReport(rpt.report_json)
    setDocument(rpt.documents)
    const n = rpt.documents?.negotiations
    setNeg(n)
    const w = n?.workspaces
    setWs(w)

    // Load logo if exists
    if (w?.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(w.logo_path)
      w.logoUrl = urlData?.publicUrl
    }

    setLoading(false)
  }

  // Auto-print once loaded
  useEffect(() => {
    if (!loading && report) {
      setTimeout(() => window.print(), 800)
    }
  }, [loading, report])

  const formatDate = d => d ? new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' }) : ''
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.loadingInner}>
        <div className={styles.ring} />
        <p>Preparing your report…</p>
      </div>
    </div>
  )

  const clauses     = report?.clauses || []
  const highClauses = clauses.filter(c => c.danger === 'HIGH')
  const medClauses  = clauses.filter(c => c.danger === 'MEDIUM')
  const lowClauses  = clauses.filter(c => c.danger === 'LOW')
  const riskNum     = Math.min(95, Math.max(5, (highClauses.length * 15) + (medClauses.length * 5) + (lowClauses.length * 2)))
  const riskLabel   = highClauses.length > 3 ? 'HIGH RISK' : highClauses.length > 0 ? 'MEDIUM RISK' : 'LOW RISK'
  const riskColor   = highClauses.length > 3 ? '#DC2626' : highClauses.length > 0 ? '#D97706' : '#16A34A'

  const RISK_COLOR  = { HIGH:'#DC2626', MEDIUM:'#D97706', LOW:'#16A34A' }
  const RISK_BG     = { HIGH:'#FEF2F2', MEDIUM:'#FFFBEB', LOW:'#F0FDF4' }

  return (
    <div className={styles.page} style={{marginTop: '56px'}}>

      {/* PRINT BAR — screen only, hidden in print */}
      <div className={styles.printBar}>
        <div className={styles.printBarLeft}>📄 {stripTimestamp(document?.filename)}</div>
        <div className={styles.printBarBtns}>
          <button className={styles.printBtnGhost} onClick={() => window.close()}>← Back</button>
          <button className={styles.printBtnPrimary} onClick={() => window.print()}>⬇ Download PDF</button>
        </div>
      </div>

      {/* COVER PAGE */}
      <div className={styles.coverPage}>
        <div className={styles.coverTop}>
          <div className={styles.coverBrand}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="5.4" fill="white"/>
            </svg>
            <span>Lease<span>Lens</span></span>
          </div>
          {ws?.client_name && <div className={styles.coverClient}>{ws.client_name}</div>}
        </div>

        <div className={styles.coverCenter}>
          <div className={styles.coverEmoji}>⚖️</div>
          <div className={styles.coverReportType}>Lease Analysis Report</div>
          <h1 className={styles.coverTitle}>{neg?.property_name || stripTimestamp(document?.filename)}</h1>
          <div className={styles.coverSubtitle}>Prepared by LeaseLens</div>
          <div className={styles.coverDivider} />
          <div className={styles.coverMeta}>
            <div className={styles.coverMetaItem}>
              <span className={styles.coverMetaLabel}>Document</span>
              <span className={styles.coverMetaVal}>{stripTimestamp(document?.filename)}</span>
            </div>
            <div className={styles.coverMetaItem}>
              <span className={styles.coverMetaLabel}>Version</span>
              <span className={styles.coverMetaVal}>{document?.version_number}</span>
            </div>
            <div className={styles.coverMetaItem}>
              <span className={styles.coverMetaLabel}>Risk Level</span>
              <span className={styles.coverMetaVal} style={{color: document?.overall_risk === 'HIGH' ? '#DC2626' : document?.overall_risk === 'MEDIUM' ? '#D97706' : '#16A34A', fontWeight:700}}>
                {document?.overall_risk}
              </span>
            </div>
            <div className={styles.coverMetaItem}>
              <span className={styles.coverMetaLabel}>Generated</span>
              <span className={styles.coverMetaVal}>{formatDate(new Date())}</span>
            </div>
          </div>
        </div>

        <div className={styles.coverBottom}>
          <div className={styles.coverConfidential}>
            This report is confidential and intended solely for the use of the tenant.
            It does not constitute legal advice.
          </div>
          <div className={styles.coverPage2}>Page 1</div>
        </div>
      </div>

      {/* PAGE BREAK after cover */}
      <div className={styles.pageBreak} />

      {/* HEADER — page 2 onwards only */}
      <div className={styles.headerReport}>
        <div className={styles.headerLeft}>
          {ws?.logoUrl ? (
            <img src={ws.logoUrl} alt="Logo" className={styles.wsLogo} />
          ) : (
            <div className={styles.brandLogo}>
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="#1B2B5E" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="#1B2B5E" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="#1B2B5E" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="#1B2B5E" strokeWidth="2.6" strokeLinecap="round"/>
                <circle cx="20" cy="20" r="5.4" fill="#1B2B5E"/>
              </svg>
              <span className={styles.brandName}>Lease<span>Lens</span></span>
            </div>
          )}
          {ws?.client_name && <div className={styles.headerClient}>{ws.client_name}</div>}
        </div>
        <div className={styles.headerRight}>
          <div className={styles.headerTitle}>Lease Analysis Report</div>
          <div className={styles.headerMeta}>Generated {formatDate(new Date())}</div>
          <div className={styles.headerMeta}>Version {document?.version_number} · {formatDate(document?.uploaded_at)}</div>
        </div>
      </div>

      {/* DOCUMENT TITLE */}
      <div className={styles.docTitle}>
        <div className={styles.docIcon}>{document?.filename?.split('.').pop()?.toUpperCase()}</div>
        <div>
          <h1 className={styles.docName}>{stripTimestamp(document?.filename)}</h1>
          {neg?.property_name && <div className={styles.docProp}>{neg.property_name} {ws?.name ? `· ${ws.name}` : ''}</div>}
        </div>
      </div>

      {/* RISK OVERVIEW */}
      <div className={styles.riskOverview}>
        <div className={styles.riskScore}>
          <div className={styles.riskNum} style={{color: riskColor}}>{riskNum}</div>
          <div className={styles.riskOf}>/100</div>
          <div className={styles.riskLabel} style={{background: RISK_BG[document?.overall_risk || 'HIGH'], color: riskColor}}>
            {riskLabel}
          </div>
        </div>
        <div className={styles.riskBreakdown}>
          {[
            { label:'High priority', count: highClauses.length, color:'#DC2626', bg:'#FEF2F2' },
            { label:'Medium', count: medClauses.length, color:'#D97706', bg:'#FFFBEB' },
            { label:'Low / standard', count: lowClauses.length, color:'#16A34A', bg:'#F0FDF4' },
            { label:'Total clauses', count: clauses.length, color:'#1B2B5E', bg:'#EEF1F8' },
          ].map((r, i) => (
            <div key={i} className={styles.rbCard} style={{background: r.bg}}>
              <div className={styles.rbCount} style={{color: r.color}}>{r.count}</div>
              <div className={styles.rbLabel}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SUMMARY */}
      {report?.summary && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Plain-English Summary</div>
          <p className={styles.summaryText}>{report.summary}</p>
        </div>
      )}

      {/* CLAUSES */}
      {['HIGH', 'MEDIUM', 'LOW'].map(risk => {
        const group = clauses.filter(c => c.danger === risk)
        if (group.length === 0) return null
        return (
          <div key={risk} className={styles.section}>
            <div className={styles.sectionTitle} style={{color: RISK_COLOR[risk]}}>
              {risk === 'HIGH' ? '⚠ High Priority Clauses' : risk === 'MEDIUM' ? '⚡ Medium Priority Clauses' : '✓ Low / Standard Clauses'}
              <span className={styles.clauseCount}> ({group.length})</span>
            </div>
            {group.map((c, i) => (
              <div key={i} className={styles.clause}>
                <div className={styles.clauseHead}>
                  <div className={styles.clauseBar} style={{background: RISK_COLOR[c.danger]}} />
                  <div className={styles.clauseHeadContent}>
                    <div className={styles.clauseRef}>{c.location}</div>
                    <div className={styles.clauseName}>{c.name}</div>
                  </div>
                  <div className={styles.clauseRisk} style={{background: RISK_BG[c.danger], color: RISK_COLOR[c.danger]}}>
                    {c.danger}
                  </div>
                </div>

                {c.quote && (
                  <div className={styles.clauseQuote}>
                    <div className={styles.quoteLabel}>Clause wording</div>
                    <p>"{c.quote}"</p>
                  </div>
                )}

                <div className={styles.clauseBody}>
                  {c.risk && (
                    <div className={styles.clauseBlock}>
                      <div className={styles.blockLabel}>What this means</div>
                      <p>{c.risk}</p>
                    </div>
                  )}
                  {c.counter && (
                    <div className={`${styles.clauseBlock} ${styles.counterBlock}`}>
                      <div className={styles.blockLabel} style={{color:'#b48c3f'}}>Suggested counter</div>
                      <p>{c.counter}</p>
                    </div>
                  )}
                  {c.legislation && (
                    <div className={`${styles.clauseBlock} ${styles.legBlock}`}>
                      <div className={styles.blockLabel} style={{color:'#16A34A'}}>Relevant legislation</div>
                      <p>{c.legislation}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {/* NEXT STEPS */}
      {report?.next_steps?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Recommended Next Steps</div>
          <ol className={styles.nextSteps}>
            {report.next_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* FOOTER */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerBrand}>LeaseLens</span>
          <span>· Retail Lease Intelligence</span>
        </div>
        <div className={styles.footerCenter}>
          LeaseLens provides informational analysis and does not constitute legal advice.
          Always consult a qualified Australian solicitor before signing.
        </div>
        <div className={styles.footerRight}>
          {formatDate(new Date())}
        </div>
      </div>

    </div>
  )
}
