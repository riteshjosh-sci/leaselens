import styles from './NegotiationDetail.module.css'

const CheckIcon = ({ s = 12 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3 8.2l3.2 3.2L13 4.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function SummaryTab({
  ws, allClauses, openClauses, counteringClauses, agreedClauses,
  getCounterText, isEdited, lifecycle, updateLifecycle, copied, handleCopy,
  buildSummary, onEditClause, onBackToReview,
}) {
  if (!allClauses.length) {
    return (
      <div className={styles.panel} style={{ marginTop: 24 }}>
        <div className={styles.panelHead}><h2>Summary</h2></div>
        <div className={styles.empty}>No report yet — analyse a document to see a summary here.</div>
      </div>
    )
  }

  return (
    <div className={styles.summaryWrap}>
      <div className={styles.summaryMain}>

        <div className={styles.brief}>
          <div className={styles.briefHead}>
            <div className={styles.briefKicker}>Response brief</div>
            <h2 className={styles.briefTitle}>
              Negotiation response — {ws?.name || 'Workspace'}
            </h2>
            {ws?.client_name && <div className={styles.briefMeta}>{ws.client_name}</div>}
          </div>

          {openClauses.length > 0 && (
            <div className={styles.toDecideNote}>
              <span className={styles.toDecideIc}>{openClauses.length}</span>
              <span className={styles.toDecideTx}>
                <b>{openClauses.length} clause{openClauses.length !== 1 ? 's' : ''}</b> still need{openClauses.length === 1 ? 's' : ''} a decision before this brief is complete.
              </span>
              <button className={styles.toDecideGo} onClick={onBackToReview}>
                Back to review →
              </button>
            </div>
          )}

          <div className={styles.briefSec}>
            <div className={styles.briefSecHead}>
              <span className={styles.briefSecTitle}>Clauses we're countering</span>
              <span className={styles.briefSecCt}>· {counteringClauses.length}</span>
            </div>
            {counteringClauses.length ? (
              <>
                <p className={styles.briefSintro}>The wording below is what LeaseRoom will package up for the agent. Each entry is either the AI suggestion or your edited version.</p>
                {counteringClauses.map((c, i) => {
                  const edited = isEdited(c)
                  return (
                    <div key={c.clauseKey} className={styles.counterItem}>
                      <div className={styles.ciNum}>{i + 1}.</div>
                      <div className={styles.ciBody}>
                        <div className={styles.ciTop}>
                          {c.location && <span className={styles.ciRef}>{c.location}</span>}
                          <span className={styles.ciName}>{c.name}</span>
                          <button className={styles.ciEdit} onClick={() => onEditClause(c.clauseKey)}>
                            Edit →
                          </button>
                        </div>
                        <div className={styles.ciText}>"{getCounterText(c)}"</div>
                        <span className={`${styles.editTag} ${styles.ciTag} ${edited ? styles.editTagEdited : styles.editTagSuggested}`}>
                          <span className={styles.editTagDot} />
                          {edited ? 'Your wording' : 'LeaseRoom suggested wording'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className={styles.briefEmpty}>Nothing to counter yet — counter a clause in Review and it lands here.</div>
            )}
          </div>

          <div className={styles.briefSec}>
            <div className={styles.briefSecHead}>
              <span className={styles.briefSecTitle}>Accepted as drafted</span>
              <span className={styles.briefSecCt}>· {agreedClauses.length}</span>
            </div>
            {agreedClauses.length ? (
              <div className={styles.agreedList}>
                {agreedClauses.map(c => (
                  <div key={c.clauseKey} className={styles.agreedRow}>
                    <span className={styles.agreedTick}><CheckIcon s={12} /></span>
                    <div className={styles.agreedBody}>
                      {c.location && <div className={styles.agreedRef}>{c.location}</div>}
                      <div className={styles.agreedName}>{c.name}</div>
                    </div>
                    <span className={styles.agreedState}>Accepted</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.briefEmpty}>No clauses accepted yet.</div>
            )}
          </div>
        </div>

        <div className={styles.copyCard}>
          <div className={styles.ccHead}>
            <div>
              <div className={styles.ccTitle}>Response summary</div>
              <div className={styles.ccSub}>Plain text, ready to paste into an email</div>
            </div>
            <button className={`${styles.ccCopy} ${copied ? styles.ccCopyDone : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className={styles.ccPre}>{buildSummary()}</pre>
        </div>
      </div>

      <div className={styles.summarySide}>
        <div className={styles.sendCard}>
          <h3 className={styles.sendCardTitle}>Ready to send</h3>
          <p className={styles.sendCardP}>
            {openClauses.length
              ? `Decide the last ${openClauses.length} clause${openClauses.length !== 1 ? 's' : ''} to finish your brief.`
              : 'Every flagged clause has a decision. Send the brief to the landlord\'s agent or export it for your records.'}
          </p>
          <div className={styles.sendCounts}>
            <div className={styles.sendCount}>
              <div className={`${styles.sendN} ${styles.sendNCnt}`}>{counteringClauses.length}</div>
              <div className={styles.sendL}>Countering</div>
            </div>
            <div className={styles.sendCount}>
              <div className={`${styles.sendN} ${styles.sendNAgr}`}>{agreedClauses.length}</div>
              <div className={styles.sendL}>Agreed</div>
            </div>
            <div className={styles.sendCount}>
              <div className={styles.sendN}>{openClauses.length}</div>
              <div className={styles.sendL}>To decide</div>
            </div>
          </div>
          <button className={styles.sendExport} onClick={handleCopy}>
            {copied ? '✓ Copied to clipboard' : 'Copy email to clipboard'}
          </button>
          {lifecycle === 'awaiting' || lifecycle === 'sent' ? (
            <div className={styles.markedDone}><CheckIcon s={12} /> With landlord for review</div>
          ) : (
            <button className={styles.markSent} onClick={() => updateLifecycle('awaiting')}>
              Mark as with landlord for review
            </button>
          )}
        </div>
        <p className={styles.disclaimer}>LeaseRoom provides informational analysis and does not constitute legal advice.</p>
      </div>
    </div>
  )
}
