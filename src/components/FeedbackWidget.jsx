import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import html2canvas from 'html2canvas'
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
  const [open, setOpen]               = useState(false)
  const [message, setMessage]         = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)
  const [error, setError]             = useState('')
  const [capturing, setCapturing]     = useState(false)
  const [screenshotPreview, setScreenshotPreview] = useState(null) // data URL, for display only
  const [screenshotBlob, setScreenshotBlob]       = useState(null)

  if (!user) return null
  if (location.pathname.startsWith('/admin')) return null
  if (user.email === ADMIN_EMAIL) return null

  const reset = () => {
    setMessage(''); setError(''); setSubmitted(false)
    setScreenshotPreview(null); setScreenshotBlob(null)
  }

  const handleClose = () => {
    setOpen(false)
    if (!submitted) reset()
  }

  const captureScreenshot = async () => {
    setCapturing(true)
    try {
      const canvas = await html2canvas(document.body, {
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        scale: 0.6,
        logging: false,
        // Don't capture the widget's own button/panel in the screenshot
        ignoreElements: (el) => el.dataset?.feedbackWidget === 'true',
      })
      setScreenshotPreview(canvas.toDataURL('image/png'))
      canvas.toBlob(blob => setScreenshotBlob(blob), 'image/png', 0.85)
    } catch {
      // Screenshot capture is best-effort -- feedback still works without one
      setScreenshotPreview(null)
      setScreenshotBlob(null)
    }
    setCapturing(false)
  }

  const handleOpen = () => {
    setOpen(true)
    captureScreenshot()
  }

  const handleRemoveScreenshot = () => {
    setScreenshotPreview(null)
    setScreenshotBlob(null)
  }

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSubmitting(true); setError('')

    let screenshot_path = null
    if (screenshotBlob) {
      const path = `${user.id}/${Date.now()}.png`
      const { error: upErr } = await supabase.storage
        .from('feedback-screenshots')
        .upload(path, screenshotBlob, { contentType: 'image/png' })
      if (!upErr) screenshot_path = path
    }

    const { error: err } = await supabase.from('feedback').insert({
      user_id:         user.id,
      email:           user.email,
      page_path:       location.pathname,
      message:         message.trim(),
      screenshot_path,
    })
    setSubmitting(false)
    if (err) { setError('Could not send feedback — please try again.'); return }
    setSubmitted(true)
    setTimeout(() => { handleClose() }, 2000)
  }

  return (
    <>
      <button
        className={styles.fab}
        data-feedback-widget="true"
        onClick={() => (open ? handleClose() : handleOpen())}
        title={open ? 'Close feedback' : 'Report an issue or share feedback'}
        aria-label={open ? 'Close feedback' : 'Report an issue or share feedback'}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <div className={styles.panel} data-feedback-widget="true">
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

              {capturing && <div className={styles.screenshotHint}>Capturing a screenshot of this page…</div>}
              {screenshotPreview && !capturing && (
                <div className={styles.screenshotPreview}>
                  <img src={screenshotPreview} alt="Page screenshot preview" />
                  <button className={styles.removeShot} onClick={handleRemoveScreenshot} title="Don't include this screenshot">
                    Remove screenshot
                  </button>
                </div>
              )}

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
