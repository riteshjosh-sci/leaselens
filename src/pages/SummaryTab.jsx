import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './NegotiationDetail.module.css'

const CheckIcon = ({ s = 12 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3 8.2l3.2 3.2L13 4.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function SummaryTab({
  negId,
  ws, allClauses, openClauses, counteringClauses, agreedClauses,
  getCounterText, isEdited, lifecycle, updateLifecycle, copied, handleCopy,
  buildSummary, onEditClause, onBackToReview,
}) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [toEmail,   setToEmail]   = useState('')
  const [toName,    setToName]    = useState('')
  const [message,   setMessage]   = useState('')
  const [sending,   setSending]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [sendError, setSendError] = useState(null)

  const handleSendEmail = async (e) => {
    e.preventDefault()
    setSending(true)
    setSendError(null)
    try {
      const { error } = await supabase.functions.invoke('send-report', {
        body: {
          to_email:         toEmail.trim(),
          to_name:          toName.trim() || undefined,
          personal_message: message.trim() || undefined,
          property_name:    ws?.name || 'Property',
          client_name:      ws?.client_name || undefined,
          from_name:        ws?.client_name || undefined,
          neg_id:           negId,
          countering: counteringClauses.map(c => ({
            location: c.location,
            name:     c.name,
            counter:  getCounterText(c) || '',
          })),
          agreed: agreedClauses.map(c => ({
            location: c.location,
            name:     c.name,
          })),
        },
      })
      if (error) throw new Error(error.message)
      setSent(true)
      if (!['awaiting', 'sent', 'agreed'].includes(lifecycle)) {
        updateLifecycle('awaiting')
      }
    } catch (err) {
      setSendError(err.message || 'Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const resetEmailForm = () => {
    setSent(false)
    setToEmail('')
    setToName('')
    setMessage('')
    setSendError(null)
  }

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

          {/* ── Email form ── */}
          {emailOpen ? (
            sent ? (
              <div style={{ textAlign: 'center', padding: '14px 4px 6px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--st-agreed-tx)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <CheckIcon s={13} /> Report sent
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{toEmail}</div>
                <button
                  onClick={resetEmailForm}
                  style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)' }}
                >
                  Send to another →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Email report</span>
                  <button
                    type="button"
                    onClick={() => { setEmailOpen(false); setSendError(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', fontFamily: 'var(--font)' }}
                  >
                    ×
                  </button>
                </div>
                <input
                  type="email"
                  required
                  placeholder="Recipient email"
                  value={toEmail}
                  onChange={e => setToEmail(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={toName}
                  onChange={e => setToName(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                />
                <textarea
                  placeholder="Personal message (optional)"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="input"
                  rows={3}
                  style={{ width: '100%', fontSize: 13, resize: 'vertical', fontFamily: 'var(--font)' }}
                />
                {sendError && (
                  <div style={{ fontSize: 12, color: 'var(--risk-h)', lineHeight: 1.4 }}>{sendError}</div>
                )}
                <button
                  type="submit"
                  disabled={sending || !toEmail.trim()}
                  className={styles.markSent}
                  style={{ marginTop: 2 }}
                >
                  {sending ? 'Sending…' : 'Send report'}
                </button>
              </form>
            )
          ) : (
            <button
              className={styles.markSent}
              onClick={() => setEmailOpen(true)}
              style={{ marginBottom: 8 }}
            >
              Email to agent ↗
            </button>
          )}

          <button className={styles.sendExport} onClick={handleCopy}>
            {copied ? '✓ Copied to clipboard' : 'Copy to clipboard'}
          </button>

          {lifecycle === 'awaiting' || lifecycle === 'sent' ? (
            <div className={styles.markedDone} style={{ marginTop: 8 }}><CheckIcon s={12} /> With landlord for review</div>
          ) : (
            <button className={styles.markSent} style={{ background: 'var(--paper)', border: '1px solid var(--hair)', color: 'var(--ink-soft)', marginTop: 8 }} onClick={() => updateLifecycle('awaiting')}>
              Mark as with landlord
            </button>
          )}
        </div>
        <p className={styles.disclaimer}>LeaseRoom provides informational analysis and does not constitute legal advice.</p>
      </div>
    </div>
  )
}
