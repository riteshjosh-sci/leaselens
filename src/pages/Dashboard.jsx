import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [negotiations, setNegotiations] = useState([])
  const [profile, setProfile]           = useState(null)
  const [loading, setLoading]           = useState(true)
  const [renaming, setRenaming]         = useState(null) // negotiation id being renamed
  const [renameVal, setRenameVal]       = useState('')

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    const [negsRes, profileRes] = await Promise.all([
      supabase
        .from('negotiations')
        .select(`id, property_name, created_at, status,
          documents ( id, filename, version_number, uploaded_at, overall_risk, file_path,
            reports ( id, created_at )
          )`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])
    setNegotiations(negsRes.data || [])
    setProfile(profileRes.data)
    setLoading(false)
  }

  const handleRename = async (negId) => {
    if (!renameVal.trim()) return
    await supabase.from('negotiations').update({ property_name: renameVal.trim() }).eq('id', negId)
    setNegotiations(prev => prev.map(n => n.id === negId ? { ...n, property_name: renameVal.trim() } : n))
    setRenaming(null)
  }

  const handleDeleteDoc = async (docId, filePath) => {
    if (!confirm('Delete this document and its report? This cannot be undone.')) return
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    await supabase.from('reports').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('id', docId)
    fetchAll()
  }

  const handleDeleteNeg = async (negId) => {
    if (!confirm('Delete this entire negotiation and all its documents?')) return
    await supabase.from('negotiations').delete().eq('id', negId)
    setNegotiations(prev => prev.filter(n => n.id !== negId))
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  const riskBadge = (risk) => {
    if (!risk) return null
    const map = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' }
    return <span className={`badge ${map[risk]}`}>{risk}</span>
  }

  // Quick stats
  const totalDocs   = negotiations.reduce((a, n) => a + (n.documents?.length || 0), 0)
  const totalReports = negotiations.reduce((a, n) => a + (n.documents?.reduce((b, d) => b + (d.reports?.length || 0), 0) || 0), 0)
  const highRiskDocs = negotiations.reduce((a, n) => a + (n.documents?.filter(d => d.overall_risk === 'HIGH').length || 0), 0)

  const planLabel = { free: 'Free', one_off: 'Pay per report', monthly: 'Monthly', adviser: 'Adviser' }
  const scansLeft = profile?.plan === 'free'
    ? Math.max(0, 1 - (profile?.free_scans_used || 0))
    : profile?.plan === 'one_off'
    ? (profile?.scan_credits || 0)
    : '∞'

  if (loading) return (
    <>
      <Nav />
      <div className={styles.loading}>Loading your documents...</div>
    </>
  )

  return (
    <>
      <Nav />
      <div className={styles.page}>

        {/* HEADER */}
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>Your account</div>
            <h1 className={styles.h1}>Document history</h1>
            <p className={styles.sub}>{user?.email}</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/analyser')}>
            + New analysis
          </button>
        </div>

        {/* STATS ROW */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{negotiations.length}</div>
            <div className={styles.statLabel}>Negotiations</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{totalDocs}</div>
            <div className={styles.statLabel}>Documents</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{totalReports}</div>
            <div className={styles.statLabel}>Reports</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{ color: highRiskDocs > 0 ? 'var(--risk-h)' : 'var(--risk-l)' }}>
              {highRiskDocs}
            </div>
            <div className={styles.statLabel}>High risk docs</div>
          </div>

          {/* Plan card */}
          <div className={`${styles.statCard} ${styles.planCard}`}>
            <div className={styles.planName}>{planLabel[profile?.plan] || 'Free'}</div>
            <div className={styles.planScans}>
              {profile?.plan === 'free' || profile?.plan === 'one_off'
                ? <><strong>{scansLeft}</strong> scan{scansLeft !== 1 ? 's' : ''} remaining</>
                : <><strong>Unlimited</strong> scans</>
              }
            </div>
            {(profile?.plan === 'free' || profile?.plan === 'one_off') && (
              <button className={styles.upgradeBtn} onClick={() => navigate('/#pricing')}>
                Upgrade →
              </button>
            )}
          </div>
        </div>

        {/* NEGOTIATIONS LIST */}
        {negotiations.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📄</div>
            <h2>No documents yet</h2>
            <p>Upload your first HOA or lease to get started.</p>
            <button className="btn-primary" onClick={() => navigate('/analyser')}>
              Scan my first document →
            </button>
          </div>
        ) : (
          <div className={styles.list}>
            {negotiations.map(neg => (
              <div key={neg.id} className={styles.negotiation}>

                {/* Negotiation header */}
                <div className={styles.negHeader}>
                  <div className={styles.negLeft}>
                    {renaming === neg.id ? (
                      <div className={styles.renameRow}>
                        <input
                          className="input"
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleRename(neg.id)}
                          autoFocus
                        />
                        <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => handleRename(neg.id)}>Save</button>
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setRenaming(null)}>Cancel</button>
                      </div>
                    ) : (
                      <h2 className={styles.negTitle}>{neg.property_name || 'Unnamed negotiation'}</h2>
                    )}
                    <div className={styles.negMeta}>
                      Started {formatDate(neg.created_at)} · {neg.documents?.length || 0} version{neg.documents?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className={styles.negActions}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setRenaming(neg.id); setRenameVal(neg.property_name || '') }}>
                      Rename
                    </button>
                    <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => navigate('/analyser', { state: { negotiationId: neg.id } })}>
                      + Add version
                    </button>
                    <button className={styles.deletenegBtn} onClick={() => handleDeleteNeg(neg.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Documents */}
                <div className={styles.docs}>
                  {(neg.documents || [])
                    .sort((a, b) => a.version_number - b.version_number)
                    .map(doc => (
                      <div key={doc.id} className={styles.docRow}>
                        <div className={styles.docIcon}>
                          <svg width="12" height="16" viewBox="0 0 14 18" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 1H2a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V6L8 1z"/>
                            <path d="M8 1v5h5"/>
                          </svg>
                        </div>
                        <div className={styles.docInfo}>
                          <div className={styles.docName}>{doc.filename}</div>
                          <div className={styles.docMeta}>
                            Version {doc.version_number} · {formatDate(doc.uploaded_at)}
                            {doc.reports?.length > 0 && <span className={styles.reportCount}> · {doc.reports.length} report</span>}
                          </div>
                        </div>
                        {riskBadge(doc.overall_risk)}
                        <div className={styles.docActions}>
                          {doc.reports?.length > 0 && (
                            <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate(`/report/${doc.reports[0].id}`)}>
                              View report
                            </button>
                          )}
                          <button
                            className={styles.docDeleteBtn}
                            onClick={() => handleDeleteDoc(doc.id, doc.file_path)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}
