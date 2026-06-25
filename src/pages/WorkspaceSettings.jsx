import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './WorkspaceSettings.module.css'

export default function WorkspaceSettings() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const logoInputRef = useRef()

  const [ws, setWs]                   = useState(null)
  const [negotiations, setNegotiations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState('')
  const [shareLinks, setShareLinks]   = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  // form state
  const [name, setName]               = useState('')
  const [clientName, setClientName]   = useState('')
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const [logoUrl, setLogoUrl]         = useState(null)

  useEffect(() => { if (!user) { navigate('/login'); return } fetchAll() }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes, tokensRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('negotiations').select(`
        id, property_name, created_at,
        documents ( id, overall_risk, reports(id) )
      `).eq('workspace_id', id).order('created_at', { ascending: false }),
      supabase.from('share_tokens').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
    ])

    if (wsRes.error || !wsRes.data) { navigate('/dashboard'); return }

    const data = wsRes.data
    setWs(data)
    setName(data.name || '')
    setClientName(data.client_name || '')
    setDeliveryEmail(data.delivery_email || '')
    setNegotiations(negsRes.data || [])
    setShareLinks(tokensRes.data || [])

    if (data.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(data.logo_path)
      setLogoUrl(urlData?.publicUrl || null)
    }

    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    const { error: err } = await supabase.from('workspaces').update({
      name: name.trim() || 'Default Workspace',
      client_name: clientName.trim() || null,
      delivery_email: deliveryEmail.trim() || null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true); setSaving(false)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return }
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB.'); return }

    setLogoUploading(true); setError('')
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${id}/logo.${ext}`

    const { error: uploadErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (uploadErr) { setError(uploadErr.message); setLogoUploading(false); return }

    await supabase.from('workspaces').update({ logo_path: path }).eq('id', id)
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    setLogoUrl(urlData?.publicUrl || null)
    setWs(prev => ({ ...prev, logo_path: path }))
    setLogoUploading(false)
  }

  const handleRemoveLogo = async () => {
    if (!ws?.logo_path) return
    await supabase.storage.from('logos').remove([ws.logo_path])
    await supabase.from('workspaces').update({ logo_path: null }).eq('id', id)
    setLogoUrl(null)
    setWs(prev => ({ ...prev, logo_path: null }))
  }

  const handleCreateShareLink = async () => {
    const { data, error: err } = await supabase
      .from('share_tokens')
      .insert({ user_id: user.id, workspace_id: id, label: `Shared ${new Date().toLocaleDateString('en-AU')}` })
      .select().single()
    if (err) { setError(err.message); return }
    setShareLinks(prev => [data, ...prev])
  }

  const handleDeleteToken = async (tokenId) => {
    await supabase.from('share_tokens').delete().eq('id', tokenId)
    setShareLinks(prev => prev.filter(t => t.id !== tokenId))
  }

  const handleDeleteWorkspace = async () => {
    setDeleting(true)
    try {
      // Soft-delete all negotiations in this workspace
      const negIds = negotiations.map(n => n.id)
      if (negIds.length > 0) {
        // Soft-delete all documents in those negotiations
        await supabase
          .from('documents')
          .update({ is_deleted: true })
          .in('negotiation_id', negIds)

        // Soft-delete all negotiations
        await supabase
          .from('negotiations')
          .update({ is_deleted: true })
          .in('id', negIds)
      }

      // Soft-delete the workspace
      await supabase
        .from('workspaces')
        .update({ is_deleted: true })
        .eq('id', id)

      // Revoke all share tokens
      await supabase
        .from('share_tokens')
        .delete()
        .eq('workspace_id', id)

      navigate('/dashboard')
    } catch (e) {
      setError('Failed to delete workspace. Please try again.')
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  const shareUrl = (token) => `${window.location.origin}/shared/${token}`

  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) return <AppSidebar><div className={styles.loading}>Loading…</div></AppSidebar>

  return (
    <AppSidebar>
      <div className={styles.page}>

        <div className={styles.breadcrumb}>
          <button onClick={() => navigate('/properties')}>← Properties</button>
          <span>/</span>
          <button onClick={() => navigate(`/workspace/${id}`)}>{ws.name}</button>
          <span>/</span>
          <span>Settings</span>
        </div>

        <h1 className={styles.h1}>Workspace settings</h1>

        <div className={styles.layout}>
          <div className={styles.main}>

            {/* DETAILS */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Details</div>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label>Workspace name</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Client name <span className={styles.optional}>(optional — shown on reports)</span></label>
                  <input className="input" placeholder="e.g. Acme Retail Pty Ltd" value={clientName} onChange={e => setClientName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Delivery email <span className={styles.optional}>(auto-send PDF on completion — leave blank to use account email)</span></label>
                  <input className="input" type="email" placeholder={user?.email} value={deliveryEmail} onChange={e => setDeliveryEmail(e.target.value)} />
                </div>
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.saveRow}>
                {saved && <span className={styles.savedMsg}>✓ Saved</span>}
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>

            {/* LOGO */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Workspace logo</div>
              <div className={styles.sectionSub}>Appears on all PDF reports generated within this workspace. PNG or SVG recommended, max 2MB.</div>
              <div className={styles.logoRow}>
                {logoUrl ? (
                  <div className={styles.logoPreview}>
                    <img src={logoUrl} alt="Workspace logo" className={styles.logoImg} />
                    <div className={styles.logoActions}>
                      <button className="btn-ghost" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                        {logoUploading ? 'Uploading…' : 'Replace logo'}
                      </button>
                      <button className={styles.removeBtn} onClick={handleRemoveLogo}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <button className={styles.uploadBtn} onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                    {logoUploading ? 'Uploading…' : '+ Upload logo'}
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              </div>
            </div>

            {/* SHARE LINKS */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Client share links</div>
              <div className={styles.sectionSub}>Generate a read-only link to share this workspace&apos;s reports with a client. No login required.</div>
              <button className="btn-ghost" style={{ marginBottom: 16 }} onClick={handleCreateShareLink}>+ Generate share link</button>
              {shareLinks.length > 0 && (
                <div className={styles.tokenList}>
                  {shareLinks.map(t => (
                    <div key={t.id} className={styles.tokenRow}>
                      <div className={styles.tokenInfo}>
                        <div className={styles.tokenLabel}>{t.label || 'Share link'}</div>
                        <div className={styles.tokenDate}>Created {formatDate(t.created_at)}</div>
                      </div>
                      <div className={styles.tokenUrl} title={shareUrl(t.token)}>{shareUrl(t.token)}</div>
                      <div className={styles.tokenActions}>
                        <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(shareUrl(t.token))}>Copy</button>
                        <button className={styles.removeBtn} onClick={() => handleDeleteToken(t.id)}>Revoke</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DANGER ZONE */}
            <div className={`${styles.section} ${styles.dangerSection}`}>
              <div className={styles.sectionTitle}>Danger zone</div>
              <div className={styles.dangerRow}>
                <div>
                  <div className={styles.dangerLabel}>Delete workspace</div>
                  <div className={styles.dangerSub}>
                    Removes this workspace and all its negotiations from your dashboard.
                    Anonymised clause data is retained to improve LeaseRoom — no personally identifying information is kept.
                  </div>
                </div>
                <button className={styles.deleteBtn} onClick={() => setDeleteConfirm(true)}>
                  Delete workspace
                </button>
              </div>
            </div>

          </div>

          {/* SIDEBAR — negotiations summary */}
          <div className={styles.sidebar}>
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>Negotiations</div>
              {negotiations.length === 0 ? (
                <div className={styles.sideEmpty}>No negotiations yet.</div>
              ) : (
                <div className={styles.negList}>
                  {negotiations.map(n => {
                    const reportId = n.documents?.[0]?.reports?.[0]?.id
                    const risk = n.documents?.[0]?.overall_risk
                    return (
                      <div key={n.id} className={styles.negRow}>
                        <div className={styles.negName}>{n.property_name || 'Unnamed'}</div>
                        <div className={styles.negRowMeta}>
                          {n.documents?.length || 0} doc{n.documents?.length !== 1 ? 's' : ''}
                          {risk && <span className={`badge badge-${risk.toLowerCase()}`} style={{ fontSize: 10, marginLeft: 8 }}>{risk}</span>}
                        </div>
                        {reportId && (
                          <button className={styles.viewBtn} onClick={() => navigate(`/report/${reportId}`)}>View →</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <button className={styles.analyseBtn} onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
                + Analyse document in this workspace
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className={styles.overlay} onClick={() => !deleting && setDeleteConfirm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>⚠</div>
            <h2 className={styles.modalTitle}>Delete "{ws.name}"?</h2>
            <p className={styles.modalBody}>
              This will remove the workspace and all its negotiations from your dashboard.
              Anonymised clause data is kept to improve LeaseRoom analysis — no personally identifying information is retained.
            </p>
            <p className={styles.modalBody} style={{ marginTop: 8 }}>
              <strong>This cannot be undone.</strong>
            </p>
            <div className={styles.modalActions}>
              <button className="btn-ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button className={styles.deleteConfirmBtn} onClick={handleDeleteWorkspace} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, delete workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppSidebar>
  )
}
