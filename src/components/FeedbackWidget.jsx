import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './FeedbackWidget.module.css'

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 4.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3v-3H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
      stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

export default function FeedbackWidget() {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen]           = useState(false)
  const [message, setMessage]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]         = useState('')

  if (!user) return null
  if (location.pathname.startsWith('/admin')) return null
  if (user.email === ADMIN_EMAIL) return null

  const handleClose = () => {
    setOpen(false)
    setError('')
    if (!submitted) setMessage('')
  }

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSubmitting(true); setError('')
    const { error: err } = await supabase.from('feedback').insert({
      user_id:   user.id,
      email:     user.email,
      page_path: location.pathname,
      message:   message.trim(),
    })
    setSubmitting(false)
    if (err) { setError('Could not send feedback — please try again.'); return }
    setSubmitted(true)
    setMessage('')
    setTimeout(() => { setSubmitted(false); setOpen(false) }, 2000)
  }

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => (open ? handleClose() : setOpen(true))}
        title={open ? 'Close feedback' : 'Report an issue or share feedback'}
        aria-label={open ? 'Close feedback' : 'Report an issue or share feedback'}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>Feedback</div>
          {submitted ? (
            <div className={styles.success}>✓ Thanks — we've got it.</div>
          ) : (
            <>
              <p className={styles.hint}>Spot a bug, or have a suggestion? Let us know what happened.</p>
              <textarea
                className={styles.textarea}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="What happened, or what would help?"
                rows={4}
                autoFocus
              />
              <div className={styles.pagePath}>On this page: {location.pathname}</div>
              {error && <div className={styles.error}>{error}</div>}
              <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting || !message.trim()}>
                {submitting ? 'Sending…' : 'Send feedback'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
