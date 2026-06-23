import { useEffect, useLayoutEffect, useState } from 'react'
import styles from './Tour.module.css'

// Generic spotlight tour. Steps target elements via a data-tour="<key>"
// attribute. A step with no `target` renders as a centered welcome card.
export default function Tour({ steps, storageKey }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect]           = useState(null)
  const [visible, setVisible]     = useState(false)

  const step = steps[stepIndex]

  useEffect(() => {
    if (localStorage.getItem(storageKey) === 'true') return
    setVisible(true)
  }, [storageKey])

  useLayoutEffect(() => {
    if (!visible || !step) return

    const update = () => {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [visible, stepIndex, step])

  const finish = () => {
    localStorage.setItem(storageKey, 'true')
    setVisible(false)
  }

  const next = () => {
    if (stepIndex >= steps.length - 1) { finish(); return }
    setStepIndex(i => i + 1)
  }
  const back = () => setStepIndex(i => Math.max(0, i - 1))

  if (!visible || !step) return null

  const pad = 8
  const spotStyle = rect ? {
    top:    rect.top - pad,
    left:   rect.left - pad,
    width:  rect.width + pad * 2,
    height: rect.height + pad * 2,
  } : null

  const tooltipWidth = 320
  let tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  if (rect) {
    const placement   = step.placement || 'bottom'
    const spaceBelow  = window.innerHeight - rect.bottom
    const usePlacement = placement === 'bottom' && spaceBelow < 220 ? 'top' : placement
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - tooltipWidth - 16)
    tooltipStyle = usePlacement === 'top'
      ? { top: rect.top - pad - 12, left, transform: 'translateY(-100%)' }
      : { top: rect.bottom + pad + 12, left }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={finish} />
      {spotStyle && <div className={styles.spotlight} style={spotStyle} />}
      <div className={styles.tooltip} style={{ ...tooltipStyle, width: tooltipWidth }} onClick={e => e.stopPropagation()}>
        <div className={styles.tipHead}>
          <span className={styles.tipStep}>{stepIndex + 1} / {steps.length}</span>
          <button className={styles.tipClose} onClick={finish} aria-label="Close tour">×</button>
        </div>
        <div className={styles.tipTitle}>{step.title}</div>
        <div className={styles.tipBody}>{step.body}</div>
        <div className={styles.tipActions}>
          {stepIndex > 0 && <button className={styles.tipBack} onClick={back}>Back</button>}
          <div className={styles.tipSpacer} />
          <button className={styles.tipSkip} onClick={finish}>Skip tour</button>
          <button className={styles.tipNext} onClick={next}>{stepIndex === steps.length - 1 ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </>
  )
}
