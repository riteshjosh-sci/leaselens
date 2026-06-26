import { useState, useRef, useLayoutEffect } from 'react'
import styles from './HelpTip.module.css'

const TIP_WIDTH = 240

// Small inline "?" icon that reveals a short explanation on hover or tap.
// Use next to terminology/panels that aren't self-explanatory at a glance.
export default function HelpTip({ children, placement = 'bottom' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return

    const place = () => {
      const rect = wrapRef.current.getBoundingClientRect()
      const margin = 12
      const idealLeft = rect.left + rect.width / 2 - TIP_WIDTH / 2
      const left = Math.min(Math.max(idealLeft, margin), window.innerWidth - TIP_WIDTH - margin)
      const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8
      setPos({ left, top, transform: placement === 'top' ? 'translateY(-100%)' : 'none' })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, placement])

  useLayoutEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <span
      className={styles.wrap}
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.icon}
        aria-label="More information"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
      >?</button>
      {open && pos && (
        <span
          className={styles.tip}
          style={{ left: pos.left, top: pos.top, transform: pos.transform, width: TIP_WIDTH }}
          role="tooltip"
        >
          {children}
        </span>
      )}
    </span>
  )
}
