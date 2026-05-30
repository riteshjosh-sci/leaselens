import { useState } from 'react'
import styles from './ClauseCard.module.css'

export default function ClauseCard({ clause }) {
  const [open, setOpen] = useState(false)
  const d = clause.danger || 'MEDIUM'

  const dotClass = { HIGH: styles.dotH, MEDIUM: styles.dotM, LOW: styles.dotL }
  const badgeClass = { HIGH: 'badge badge-high', MEDIUM: 'badge badge-medium', LOW: 'badge badge-low' }
  const badgeLabel = { HIGH: 'High Risk', MEDIUM: 'Medium Risk', LOW: 'Low Risk' }

  return (
    <div className={styles.clause}>
      <div className={styles.header} onClick={() => setOpen(!open)}>
        <div className={`${styles.dot} ${dotClass[d]}`} />
        <div className={styles.title}>{clause.name}</div>
        <span className={badgeClass[d]}>{badgeLabel[d]}</span>
        <span className={`${styles.chev} ${open ? styles.chevOpen : ''}`}>▼</span>
      </div>

      {open && (
        <div className={styles.body}>
          {clause.location && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Location in document</div>
              <p className={styles.meta}>{clause.location}</p>
            </div>
          )}
          {clause.quote && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Clause wording</div>
              <div className={styles.quoteBox}>
                <p>"{clause.quote}"</p>
              </div>
            </div>
          )}
          {clause.risk && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>What this means for you</div>
              <p>{clause.risk}</p>
            </div>
          )}
          {clause.context && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Why this clause exists</div>
              <p className={styles.light}>{clause.context}</p>
            </div>
          )}
          {clause.legislation && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Relevant legislation</div>
              <div className={styles.legislationBox}><p>{clause.legislation}</p></div>
            </div>
          )}
          {clause.counter && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>A possible response</div>
              <div className={styles.counterBox}><p>{clause.counter}</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
