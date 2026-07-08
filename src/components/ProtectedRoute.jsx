import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({ children }) {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [betaChecked, setBetaChecked] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setBetaChecked(false)

    const checkBeta = async (retry = true) => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('beta_validated')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (profileError) {
        // Column may not exist in this environment — fail open
        setBetaChecked(true); return
      }

      if (!profile) {
        // Profile row may not exist yet (creation trigger race) -- retry once
        if (retry) { setTimeout(() => checkBeta(false), 600); return }
        setBetaChecked(true) // can't verify -- fail open rather than lock out a real user
        return
      }

      if (profile.beta_validated) { setBetaChecked(true); return }

      // Account exists but never passed the beta gate (e.g. Login page's
      // Google button, which has no validation step of its own). If the
      // signup flow just validated a code in this browser session, honour it.
      const pending = sessionStorage.getItem('ll_beta_pending') === 'true'
      if (pending) {
        await supabase.from('profiles').update({ beta_validated: true }).eq('id', user.id)
        sessionStorage.removeItem('ll_beta_pending')
        setBetaChecked(true)
        return
      }

      // Unauthorized account -- clean it up server-side, then sign out and redirect
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/reject-unauthorized-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        })
      } catch {
        // best effort -- still sign out client-side below regardless
      }
      await signOut()
      navigate('/signup?error=beta_required', { replace: true })
    }

    checkBeta()
    return () => { cancelled = true }
  }, [user])

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!betaChecked) return null
  return children
}
