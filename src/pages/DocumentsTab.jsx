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

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const stripTimestamp = f => f?.replace(/^\d+_/, '') || ''
  const riskPillCls = { HIGH: styles.pillHigh, MEDIUM: styles.pillMed, LOW: styles.pillLow }

  // Split by type — existing docs without doc_type fall into HOA column
  const hoaDocs   = [...docs].filter(d => !d.doc_type || d.doc_type === 'hoa').sort((a, b) => b.version_number - a.version_number)
  const leaseDocs = [...docs].filter(d => d.doc_type === 'lease').sort((a, b) => b.version_number - a.version_number)

  const DocList = ({ list, type }) => (
    <div className={dStyles.col}>
      <div className={dStyles.colHead}>
        <div className={dStyles.colTitle}>{type === 'hoa' ? 'Heads of Agreement' : 'Lease'}</div>
        <button className="btn-outline btn-sm" onClick={() => onAddVersion(type)}>
          + Add {type === 'hoa' ? 'HOA' : 'Lease'}
        </button>
      </div>

      {list.length === 0 ? (
        <div className={dStyles.colEmpty}>
          <p>No {type === 'hoa' ? 'HOA' : 'lease'} documents yet.</p>
          <button className={dStyles.colEmptyCta} onClick={() => onAddVersion(type)}>
            Upload {type === 'hoa' ? 'HOA' : 'Lease'} →
          </button>
        </div>
      ) : (
        <div className={dStyles.docList}>
          {list.map((doc, i) => (
            <div key={doc.id} className={dStyles.docRow}>
              <div className={dStyles.fic}>{doc.filename?.split('.').pop()?.toUpperCase() || 'DOC'}</div>
              <div className={dStyles.dm}>
                <div className={dStyles.docRole}>
                  V{doc.version_number} · {i === 0 ? 'current' : 'superseded'}
                </div>
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

  return (
    <div className={dStyles.wrap}>
      <div className={dStyles.head}>
        <div>
          <div className={dStyles.title}>Documents</div>
          <div className={dStyles.sub}>HOA and Lease documents for this negotiation, tracked separately.</div>
        </div>
      </div>

      <div className={dStyles.columns}>
        <DocList list={hoaDocs}   type="hoa" />
        <DocList list={leaseDocs} type="lease" />
      </div>
    </div>
  )
}
