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
    const w = n?.workspaces
    setNeg(n)

    if (w?.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(w.logo_path)
      setWs({ ...w, logoUrl: urlData?.publicUrl })
    } else {
      setWs(w)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!loading && report) {
      setTimeout(() => window.print(), 900)
    }
  }, [loading, report])

  const formatDate = d => d ? new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' }) : ''
  const stripName  = f => f?.replace(/^\d+_/, '').replace(/\.[^.]+$/, '') || ''

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.ring} />
      <p>Preparing your report…</p>
    </div>
  )

  const clauses     = report?.clauses || []
  const highClauses = clauses.filter(c => c.danger === 'HIGH')
  const medClauses  = clauses.filter(c => c.danger === 'MEDIUM')
  const lowClauses  = clauses.filter(c => c.danger === 'LOW')
  const riskNum     = Math.min(95, Math.max(5, (highClauses.length * 15) + (medClauses.length * 5) + (lowClauses.length * 2)))
  const riskColor   = document?.overall_risk === 'HIGH' ? '#DC2626' : document?.overall_risk === 'MEDIUM' ? '#D97706' : '#16A34A'
  const RISK_COLOR  = { HIGH:'#DC2626', MEDIUM:'#D97706', LOW:'#16A34A' }
  const RISK_BG     = { HIGH:'#FEF2F2', MEDIUM:'#FFFBEB', LOW:'#F0FDF4' }

  return (
    <>
      {/* ── SCREEN ONLY — print toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.toolbarLogo}>
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
              <path d="M5 13 V7 a2 2 0 0 1 2-2 h6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M27 5 h6 a2 2 0 0 1 2 2 v6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M35 27 v6 a2 2 0 0 1 -2 2 h-6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <path d="M13 35 H7 a2 2 0 0 1 -2 -2 v-6" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="5.4" fill="white"/>
            </svg>
            LeaseLens
          </div>
          <span className={styles.toolbarDoc}>{stripName(document?.filename)}</span>
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.btnBack} onClick={() => window.close()}>← Back</button>
          <button className={styles.btnPrint} onClick={() => window.print()}>⬇ Download PDF</button>
        </div>
      </div>

      {/* ── PRINTABLE DOCUMENT ── */}
      <div className={styles.doc}>

        {/* ════════════════════════════════
            PAGE 1 — COVER
            ════════════════════════════════ */}
        <div className={styles.cover}>

          {/* TOP — client logo or blank space */}
          <div className={styles.coverTop}>
            {ws?.logoUrl ? (
              <img src={ws.logoUrl} alt="Client logo" className={styles.clientLogo} />
            ) : ws?.client_name ? (
              <div className={styles.clientName}>{ws.client_name}</div>
            ) : (
              <div className={styles.coverTopSpacer} />
            )}
          </div>

          {/* CENTRE — main cover content */}
          <div className={styles.coverBody}>
            <div className={styles.coverLabel}>Retail Lease Analysis Report</div>
            <h1 className={styles.coverTitle}>
              {neg?.property_name ? stripName(neg.property_name) : stripName(document?.filename)}
            </h1>
            {ws?.client_name && (
              <div className={styles.coverClient}>Prepared for {ws.client_name}</div>
            )}
            <div className={styles.coverPrepared}>Prepared by LeaseLens</div>

            {/* Risk badge */}
            <div className={styles.coverRiskRow}>
              <div className={styles.coverRiskBadge} style={{
                background: RISK_BG[document?.overall_risk || 'HIGH'],
                color: riskColor,
                border: `1.5px solid ${riskColor}30`
              }}>
                {document?.overall_risk} RISK
              </div>
              <div className={styles.coverRiskScore} style={{color: riskColor}}>
                {riskNum}<span>/100</span>
              </div>
            </div>
          </div>

          {/* BOTTOM — meta grid + confidential */}
          <div className={styles.coverBottom}>
            <div className={styles.coverMeta}>
              <div className={styles.coverMetaItem}>
                <div className={styles.coverMetaLabel}>Document</div>
                <div className={styles.coverMetaVal}>{stripName(document?.filename)}</div>
              </div>
              <div className={styles.coverMetaItem}>
                <div className={styles.coverMetaLabel}>Version</div>
                <div className={styles.coverMetaVal}>{document?.version_number}</div>
              </div>
              <div className={styles.coverMetaItem}>
                <div className={styles.coverMetaLabel}>Clauses reviewed</div>
                <div className={styles.coverMetaVal}>{clauses.length}</div>
              </div>
              <div className={styles.coverMetaItem}>
                <div className={styles.coverMetaLabel}>Generated</div>
                <div className={styles.coverMetaVal}>{formatDate(new Date())}</div>
              </div>
            </div>
            <div className={styles.coverFooter}>
              <div className={styles.coverConfidential}>
                This report is confidential and intended solely for the use of the named party.
                It does not constitute legal advice.
              </div>
              <div className={styles.coverPowered}>Powered by LeaseLens · leaselens.au</div>
            </div>
          </div>

        </div>

        {/* ════════════════════════════════
            PAGE 2+ — REPORT CONTENT
            (page break forces new page)
            ════════════════════════════════ */}
        <div className={styles.pageBreak} />

        {/* Running header on every content page */}
        <div className={styles.runningHead}>
          <span className={styles.rhLeft}>
            {neg?.property_name ? stripName(neg.property_name) : stripName(document?.filename)}
          </span>
          <span className={styles.rhRight}>Lease Analysis Report · {formatDate(new Date())}</span>
        </div>

        {/* RISK SUMMARY */}
        <div className={styles.riskSummary}>
          <div className={styles.rsScore}>
            <div className={styles.rsNum} style={{color: riskColor}}>{riskNum}</div>
            <div className={styles.rsOf}>/100</div>
            <div className={styles.rsBadge} style={{background: RISK_BG[document?.overall_risk || 'HIGH'], color: riskColor}}>
              {document?.overall_risk} RISK
            </div>
          </div>
          <div className={styles.rsBreakdown}>
            {[
              { label:'High priority', count: highClauses.length, color:'#DC2626', bg:'#FEF2F2' },
              { label:'Medium', count: medClauses.length, color:'#D97706', bg:'#FFFBEB' },
              { label:'Low / standard', count: lowClauses.length, color:'#16A34A', bg:'#F0FDF4' },
              { label:'Total clauses', count: clauses.length, color:'#1B2B5E', bg:'#EEF1F8' },
            ].map((r, i) => (
              <div key={i} className={styles.rsCard} style={{background: r.bg}}>
                <div className={styles.rsCount} style={{color: r.color}}>{r.count}</div>
                <div className={styles.rsLabel}>{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PLAIN-ENGLISH SUMMARY */}
        {report?.summary && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Plain-English Summary</div>
            <p className={styles.summaryText}>{report.summary}</p>
          </div>
        )}

        {/* CLAUSES — grouped by risk */}
        {['HIGH', 'MEDIUM', 'LOW'].map(risk => {
          const group = clauses.filter(c => c.danger === risk)
          if (!group.length) return null
          return (
            <div key={risk} className={styles.section}>
              <div className={styles.sectionTitle} style={{color: RISK_COLOR[risk]}}>
                {risk === 'HIGH' ? '⚠ High Priority Clauses'
                  : risk === 'MEDIUM' ? '⚡ Medium Priority Clauses'
                  : '✓ Low / Standard Clauses'}
                <span className={styles.clauseCount}> ({group.length})</span>
              </div>
              {group.map((c, i) => (
                <div key={i} className={styles.clause}>
                  <div className={styles.clauseHead}>
                    <div className={styles.clauseBar} style={{background: RISK_COLOR[c.danger]}} />
                    <div className={styles.clauseHeadBody}>
                      <div className={styles.clauseRef}>{c.location}</div>
                      <div className={styles.clauseName}>{c.name}</div>
                    </div>
                    <div className={styles.clauseRiskBadge} style={{
                      background: RISK_BG[c.danger], color: RISK_COLOR[c.danger]
                    }}>{c.danger}</div>
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
              {report.next_steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}

        {/* DISCLAIMER */}
        <div className={styles.disclaimer}>
          <strong>Disclaimer:</strong> LeaseLens provides informational analysis to support negotiation
          and does not constitute legal advice. Always consult a qualified Australian solicitor
          before signing any lease or heads of agreement.
        </div>

      </div>
    </>
  )
}
