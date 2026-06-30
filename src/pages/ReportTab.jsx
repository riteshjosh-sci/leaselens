import styles from './NegotiationDetail.module.css'

const RISK_PILL = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }
const RISK_BAR  = { HIGH: 'var(--accent)', MEDIUM: 'var(--risk-m)', LOW: 'var(--risk-l)' }

const ChevRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h9.5M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function ReportTab({ allClauses, onNext }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {high   > 0 && <span className={`${styles.pill} ${styles.pillHigh}`}>{high} High risk</span>}
        {medium > 0 && <span className={`${styles.pill} ${styles.pillMed}`}>{medium} Medium</span>}
        {low    > 0 && <span className={`${styles.pill} ${styles.pillLow}`}>{low} Low</span>}
        <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 4 }}>
          {allClauses.length} clauses identified
        </span>
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
