import styles from './NegotiationDetail.module.css'

const RISK_PILL = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }
const RISK_BAR  = { HIGH: 'var(--accent)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }

const ChevRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h9.5M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

function CommercialCard({ leaseData, docType }) {
  if (!leaseData) return null
  const isHoa = docType === 'hoa'
  const fmt = n => n ? `$${Number(n).toLocaleString()}` : null
  const rows = [
    { label: 'Term',             value: leaseData.term_years ? `${leaseData.term_years} years${leaseData.option_terms ? ` + ${leaseData.option_terms} option` : ''}` : null },
    { label: 'Base rent (p.a.)', value: fmt(leaseData.base_rent_annual) },
    { label: 'Outgoings (p.a.)', value: fmt(leaseData.outgoings_annual) },
    { label: 'Bank guarantee',   value: leaseData.bank_guarantee_months ? `${leaseData.bank_guarantee_months} months` : null },
    { label: 'Rent review',      value: leaseData.rent_review_type ? `${leaseData.rent_review_type.toUpperCase()}${leaseData.rent_review_rate ? ` ${leaseData.rent_review_rate}%` : ''}` : null },
    { label: 'Fitout contrib.',  value: fmt(leaseData.fitout_contribution) },
    { label: 'Permitted use',    value: leaseData.permitted_use },
  ].filter(r => r.value)
  if (!rows.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
        {isHoa ? 'Heads of Agreement' : 'Lease'} · Commercial terms
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px 20px' }}>
        {rows.map(r => (
          <div key={r.label}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 2 }}>{r.label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReportTab({ allClauses, onNext, leaseData, docType }) {
  if (!allClauses.length) {
    return (
      <div className={styles.panel} style={{ marginTop: 24 }}>
        <div className={styles.panelHead}><h2>Report</h2></div>
        <div className={styles.empty}>No report available yet — analyse a document to see findings here.</div>
      </div>
    )
  }

  const high   = allClauses.filter(c => c.danger === 'HIGH').length
  const medium = allClauses.filter(c => c.danger === 'MEDIUM').length
  const low    = allClauses.filter(c => c.danger === 'LOW').length

  return (
    <div style={{ paddingTop: 24 }}>
      <CommercialCard leaseData={leaseData} docType={docType} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {high   > 0 && <span className={`${styles.pill} ${styles.pillHigh}`}>{high} High risk</span>}
          {medium > 0 && <span className={`${styles.pill} ${styles.pillMed}`}>{medium} Medium</span>}
          {low    > 0 && <span className={`${styles.pill} ${styles.pillLow}`}>{low} Low</span>}
          <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 4 }}>
            {allClauses.length} clauses identified
          </span>
        </div>
        <button className="btn-primary" onClick={onNext}>
          Next: Review clauses <ChevRight />
        </button>
      </div>

      {allClauses.map(c => (
        <div key={c.clauseKey} className={styles.panel} style={{ marginBottom: 12 }}>
          <div className={styles.panelHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <span style={{ width: 3, height: 14, borderRadius: 2, background: RISK_BAR[c.danger] || 'var(--muted)', flexShrink: 0, display: 'inline-block' }} />
              <div style={{ minWidth: 0 }}>
                {c.location && (
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>
                    {c.location}
                  </div>
                )}
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
              </div>
            </div>
            {c.danger && (
              <span className={`${styles.pill} ${RISK_PILL[c.danger] || ''}`}>{c.danger}</span>
            )}
          </div>
          {c.risk && (
            <div style={{ padding: '14px 18px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
              {c.risk}
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0 32px' }}>
        <button className="btn-primary" onClick={onNext}>
          Next: Review clauses <ChevRight />
        </button>
      </div>
    </div>
  )
}
