import { useState, useRef, useEffect } from 'react'
import styles from './HelpTip.module.css'

// Small inline "?" icon that reveals a short explanation on hover or tap.
// Use next to terminology/panels that aren't self-explanatory at a glance.
export default function HelpTip({ children, placement = 'bottom' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <span
      className={styles.wrap}
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.icon}
        aria-label="More information"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
      >?</button>
      {open && (
        <span className={`${styles.tip} ${styles[placement]}`} role="tooltip">
          {children}
        </span>
      )}
    </span>
  )
}
