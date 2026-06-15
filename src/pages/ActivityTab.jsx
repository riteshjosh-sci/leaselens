import dStyles from './ActivityTab.module.css'

export default function ActivityTab({ neg, docs, ws }) {
  // Build timeline from existing data — no activity table yet
  const events = []

  // Workspace created
  if (ws?.created_at) {
    events.push({
      id: 'ws-created',
      type: 'system',
      text: `Workspace <b>${ws.name}</b> created.`,
      date: ws.created_at,
    })
  }

  // Negotiation created
  if (neg?.created_at) {
    events.push({
      id: 'neg-created',
      type: 'user',
      text: `Negotiation <b>${neg.property_name || 'Unnamed'}</b> started.`,
      date: neg.created_at,
    })
  }

  // Each document uploaded
  ;(docs || []).forEach(doc => {
    const name = doc.filename?.replace(/^\d+_/, '') || 'Document'
    events.push({
      id: `doc-${doc.id}`,
      type: 'system',
      text: `<b>${name}</b> uploaded — version ${doc.version_number}${doc.overall_risk ? `, ${doc.overall_risk} risk` : ''}.`,
      date: doc.uploaded_at,
    })
    if (doc.reports?.[0]) {
      events.push({
        id: `report-${doc.id}`,
        type: 'system',
        text: `Analysis complete on <b>${name}</b>.`,
        date: doc.reports[0].created_at || doc.uploaded_at,
      })
    }
  })

  // Sort newest first
  events.sort((a, b) => new Date(b.date) - new Date(a.date))

  const formatDate = d => {
    const date = new Date(d)
    const now  = new Date()
    const diff = now - date
    const days = Math.floor(diff / 86400000)
    if (days === 0) return `Today · ${date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
    if (days === 1) return `Yesterday · ${date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className={dStyles.wrap}>
      <div className={dStyles.head}>
        <div className={dStyles.title}>Activity</div>
        <div className={dStyles.sub}>A timeline of everything that's happened in this workspace.</div>
      </div>

      {events.length === 0 ? (
        <div className={dStyles.empty}>No activity yet.</div>
      ) : (
        <div className={dStyles.feed}>
          {events.map(ev => (
            <div key={ev.id} className={dStyles.ev}>
              <div className={`${dStyles.av} ${ev.type === 'system' ? dStyles.avSys : dStyles.avUser}`}>
                {ev.type === 'system' ? '◆' : (ws?.name?.[0]?.toUpperCase() || 'U')}
              </div>
              <div className={dStyles.ex}>
                <div className={dStyles.tx} dangerouslySetInnerHTML={{ __html: ev.text }} />
                <div className={dStyles.tm}>{formatDate(ev.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
