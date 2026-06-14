import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppSidebar from '../components/AppSidebar'
import styles from './WorkspaceSettings.module.css'

const MenuIcon  = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const CheckIcon = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const CopyIcon  = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M4 13V4a1 1 0 0 1 1-1h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const TrashIcon = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4h4v2M7 9v6M13 9v6M5 6l1 10h8l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ArrowIcon = () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const LinkIcon  = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M8 12a4 4 0 0 0 5.66 0l2-2a4 4 0 0 0-5.66-5.66l-1 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 8a4 4 0 0 0-5.66 0l-2 2a4 4 0 0 0 5.66 5.66l1-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const UploadIcon= () => <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 13V4M6 8l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>

export default function WorkspaceSettings() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const logoInputRef = useRef()

  const [ws, setWs]             = useState(null)
  const [negotiations, setNeg]  = useState([])
  const [shareLinks, setLinks]  = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copied, setCopied]     = useState(null)
  const [activeTab, setActiveTab] = useState('details')

  const [name, setName]         = useState('')
  const [clientName, setClientName] = useState('')
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const [logoUrl, setLogoUrl]   = useState(null)

  useEffect(() => { if (!user) { navigate('/login'); return }; fetchAll() }, [id, user])

  const fetchAll = async () => {
    const [wsRes, negsRes, tokensRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('negotiations').select(`id, property_name, created_at, lifecycle,
        documents ( id, overall_risk, reports(id) )`).eq('workspace_id', id).order('created_at', { ascending: false }),
      supabase.from('share_tokens').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
    ])
    if (wsRes.error || !wsRes.data) { navigate('/workspaces'); return }
    const data = wsRes.data
    setWs(data); setName(data.name || ''); setClientName(data.client_name || '')
    setDeliveryEmail(data.delivery_email || ''); setNeg(negsRes.data || []); setLinks(tokensRes.data || [])
    if (data.logo_path) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(data.logo_path)
      setLogoUrl(urlData?.publicUrl || null)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    const { error: err } = await supabase.from('workspaces').update({
      name: name.trim() || 'Workspace', client_name: clientName.trim() || null, delivery_email: deliveryEmail.trim() || null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 2500)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please upload an image.'); return }
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB.'); return }
    setLogoUploading(true); setError('')
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${id}/logo.${ext}`
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (upErr) { setError(upErr.message); setLogoUploading(false); return }
    await supabase.from('workspaces').update({ logo_path: path }).eq('id', id)
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    setLogoUrl(urlData?.publicUrl || null); setWs(p => ({ ...p, logo_path: path }))
    setLogoUploading(false)
  }

  const handleRemoveLogo = async () => {
    if (!ws?.logo_path) return
    await supabase.storage.from('logos').remove([ws.logo_path])
    await supabase.from('workspaces').update({ logo_path: null }).eq('id', id)
    setLogoUrl(null); setWs(p => ({ ...p, logo_path: null }))
  }

  const handleCreateLink = async () => {
    const tokenArr = new Uint8Array(32)
    crypto.getRandomValues(tokenArr)
    const token = Array.from(tokenArr).map(b => b.toString(16).padStart(2,'0')).join('')

    const { data, error: err } = await supabase.from('share_tokens').insert({
      user_id: user.id, workspace_id: id, token,
      label: `Shared ${new Date().toLocaleDateString('en-AU')}`,
      expires_at: new Date(Date.now() + 90*24*60*60*1000).toISOString()
    }).select().single()
    if (err) { setError(err.message); return }
    setLinks(p => [data, ...p])
  }

  const handleDeleteLink = async (tokenId) => {
    await supabase.from('share_tokens').delete().eq('id', tokenId)
    setLinks(p => p.filter(t => t.id !== tokenId))
  }

  const handleCopy = async (text, id) => {
    await navigator.clipboard.writeText(text)
    setCopied(id); setTimeout(() => setCopied(null), 2000)
  }

  const shareUrl = t => `${window.location.origin}/shared/${t}`
  const formatDate = d => new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })
  const stripName = f => (f||'').replace(/^\d+_/, '').replace(/\.[^.]+$/, '').replace(/_/g,' ')

  const lcLabel = { reviewing:'Reviewing', counter_prepared:'Counter prepared', sent:'Sent', awaiting:'Awaiting', agreed:'Agreed' }

  if (loading) return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main"><div className={styles.loading}><div className={styles.ring} /></div></main>
    </div>
  )

  return (
    <div className="app-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="app-main">

        {/* TOP BAR */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setMobileOpen(true)}><MenuIcon /></button>
            <div>
              <div className={styles.crumb}>
                <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                <span>›</span>
                <button onClick={() => navigate('/workspaces')}>Workspaces</button>
                <span>›</span>
                <button onClick={() => navigate(`/workspace/${id}`)}>{ws.name}</button>
                <span>›</span>
                <span>Settings</span>
              </div>
              <h1 className={styles.h1}>Workspace settings</h1>
              <p className={styles.sub}>{ws.name}</p>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <button className="btn-outline btn-sm" onClick={() => navigate(`/workspace/${id}`)}>
              ← Back to workspace
            </button>
            <button className="btn-gold btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? <><CheckIcon /> Saved</> : 'Save changes'}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className={styles.tabBar}>
          {['details', 'branding', 'sharing'].map(t => (
            <button key={t} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t)}>
              {t === 'details' ? 'Details' : t === 'branding' ? 'Branding & Logo' : 'Client Sharing'}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          <div className={styles.layout}>
            <div className={styles.main}>

              {error && <div className={styles.errorBox}>{error}</div>}

              {/* ── DETAILS TAB ── */}
              {activeTab === 'details' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle}>Workspace details</h2>
                    <p className={styles.sSub}>Basic information about this property negotiation.</p>
                  </div>
                  <div className={styles.fields}>
                    <div className={styles.field}>
                      <label>Workspace name <span className={styles.req}>*</span></label>
                      <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Shop 4, 123 Collins St" />
                    </div>
                    <div className={styles.field}>
                      <label>Client name <span className={styles.opt}>(shown on reports)</span></label>
                      <input className="input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Craftsman Barbers Pty Ltd" />
                    </div>
                    <div className={styles.field}>
                      <label>Delivery email <span className={styles.opt}>(PDF auto-send on completion)</span></label>
                      <input className="input" type="email" value={deliveryEmail} onChange={e => setDeliveryEmail(e.target.value)} placeholder={user?.email} />
                    </div>
                  </div>
                  <div className={styles.saveRow}>
                    <button className="btn-gold" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : saved ? <><CheckIcon /> Saved</> : 'Save changes'}
                    </button>
                    {saved && <span className={styles.savedMsg}>Changes saved successfully</span>}
                  </div>
                </div>
              )}

              {/* ── BRANDING TAB ── */}
              {activeTab === 'branding' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle}>Branding & Logo</h2>
                    <p className={styles.sSub}>Your logo will appear on all PDF reports generated in this workspace. PNG or SVG recommended, max 2MB.</p>
                  </div>
                  {logoUrl ? (
                    <div className={styles.logoPreview}>
                      <img src={logoUrl} alt="Logo" className={styles.logoImg} />
                      <div className={styles.logoBtns}>
                        <button className="btn-outline btn-sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                          {logoUploading ? 'Uploading…' : 'Replace logo'}
                        </button>
                        <button className={styles.removeBtn} onClick={handleRemoveLogo}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.uploadZone} onClick={() => logoInputRef.current?.click()}>
                      <div className={styles.uploadIcon}><UploadIcon /></div>
                      <div className={styles.uploadLabel}>{logoUploading ? 'Uploading…' : 'Click to upload logo'}</div>
                      <div className={styles.uploadSub}>PNG, SVG, JPG up to 2MB</div>
                    </div>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleLogoUpload} />
                </div>
              )}

              {/* ── SHARING TAB ── */}
              {activeTab === 'sharing' && (
                <div className={styles.section}>
                  <div className={styles.sHead}>
                    <h2 className={styles.sTitle}>Client share links</h2>
                    <p className={styles.sSub}>Generate read-only links to share this workspace's reports with clients. No login required.</p>
                  </div>
                  <button className="btn-outline btn-sm" style={{marginBottom:20}} onClick={handleCreateLink}>
                    <LinkIcon /> Generate share link
                  </button>
                  {shareLinks.length === 0 ? (
                    <div className={styles.emptyLinks}>No share links yet. Generate one above.</div>
                  ) : (
                    <div className={styles.linkList}>
                      {shareLinks.map(t => (
                        <div key={t.id} className={styles.linkRow}>
                          <div className={styles.linkInfo}>
                            <div className={styles.linkLabel}>{t.label || 'Share link'}</div>
                            <div className={styles.linkDate}>Created {formatDate(t.created_at)}</div>
                          </div>
                          <div className={styles.linkUrl}>{shareUrl(t.token)}</div>
                          <div className={styles.linkActions}>
                            <button className={`${styles.copyBtn} ${copied === t.id ? styles.copyBtnDone : ''}`}
                              onClick={() => handleCopy(shareUrl(t.token), t.id)}>
                              {copied === t.id ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                            </button>
                            <button className={styles.revokeBtn} onClick={() => handleDeleteLink(t.id)}>
                              <TrashIcon /> Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* SIDEBAR */}
            <div className={styles.sidebar}>
              <div className={styles.sCard}>
                <h3 className={styles.sCardTitle}>Negotiations</h3>
                {negotiations.length === 0 ? (
                  <div className={styles.sideEmpty}>No negotiations yet.</div>
                ) : (
                  <div className={styles.negList}>
                    {negotiations.map(n => {
                      const reportId = n.documents?.[0]?.reports?.[0]?.id
                      const risk = n.documents?.[0]?.overall_risk
                      return (
                        <div key={n.id} className={styles.negRow}>
                          <div className={styles.negBadge}>{(n.property_name||'N')[0]?.toUpperCase()}</div>
                          <div className={styles.negInfo}>
                            <div className={styles.negName}>{stripName(n.property_name)}</div>
                            <div className={styles.negMeta}>
                              {n.documents?.length || 0} doc{n.documents?.length !== 1 ? 's' : ''}
                              {risk && <span className={`badge badge-${risk.toLowerCase()}`} style={{fontSize:10, marginLeft:6}}>{risk}</span>}
                              {n.lifecycle && n.lifecycle !== 'reviewing' && (
                                <span className={styles.lcTag}>{lcLabel[n.lifecycle]}</span>
                              )}
                            </div>
                          </div>
                          {reportId && (
                            <button className={styles.viewBtn} onClick={() => navigate(`/report/${reportId}`)}>
                              <ArrowIcon />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <button className={styles.analyseBtn}
                  onClick={() => navigate('/analyser', { state: { workspaceId: id } })}>
                  + Analyse document
                </button>
              </div>

              {/* Workspace info card */}
              <div className={styles.sCard}>
                <h3 className={styles.sCardTitle}>Quick info</h3>
                <div className={styles.infoRows}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Created</span>
                    <span className={styles.infoVal}>{formatDate(ws.created_at)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Negotiations</span>
                    <span className={styles.infoVal}>{negotiations.length}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Share links</span>
                    <span className={styles.infoVal}>{shareLinks.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
