import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './NegotiationDetail.module.css'
import dStyles from './DocumentsTab.module.css'

export default function DocumentsTab({ negId, docs, setDocs, onAddVersion }) {
  const navigate = useNavigate()

  const handleDeleteDoc = async (docId, filePath) => {
    if (!confirm('Delete this document and its report?')) return
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    await supabase.from('reports').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const riskPillCls = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }

  return (
    <div className={dStyles.wrap}>
      <div className={dStyles.head}>
        <div>
          <div className={dStyles.title}>Documents</div>
          <div className={dStyles.sub}>Every version uploaded for this negotiation. The current version is what LeaseLens reviews.</div>
        </div>
        <button className="btn-ink btn-sm" onClick={onAddVersion}>+ Add document</button>
      </div>

      {docs.length === 0 ? (
        <div className={dStyles.empty}>
          <p>No documents yet.</p>
          <button className="btn-ink btn-sm" style={{ marginTop: 16 }} onClick={onAddVersion}>
            Analyse document →
          </button>
        </div>
      ) : (
        <div className={dStyles.docList}>
          {docs.map((doc, i) => (
            <div key={doc.id} className={dStyles.docRow}>
              <div className={dStyles.fic}>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
              <div className={dStyles.dm}>
                <div className={dStyles.docRole}>v{doc.version_number} {i === 0 ? '· current' : '· superseded'}</div>
                <div className={dStyles.docFn}>{stripTimestamp(doc.filename)}</div>
                <div className={dStyles.docMeta}>{formatDate(doc.uploaded_at)}</div>
              </div>
              <div className={dStyles.pills}>
                {i === 0 && <span className={dStyles.pillCur}>Current</span>}
                {doc.overall_risk && (
                  <span className={`${styles.pill} ${riskPillCls[doc.overall_risk]}`}>{doc.overall_risk}</span>
                )}
              </div>
              <div className={dStyles.docActions}>
                {doc.reports?.[0]?.id ? (
                  <button className="btn-outline btn-sm" onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                    View report →
                  </button>
                ) : (
                  <span className={dStyles.processing}>Processing…</span>
                )}
                <button className={dStyles.delBtn} onClick={() => handleDeleteDoc(doc.id, doc.file_path)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
