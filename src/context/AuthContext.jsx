import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, checkFreeReset } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase fires this on every token refresh (including right after a
      // background tab regains focus), not just on real sign-in/out. Keep the
      // same object reference when the user identity hasn't changed, so
      // components depending on `user` in a useEffect array (most pages, plus
      // ProtectedRoute's beta check) don't re-run and flash blank/reload.
      setUser(prev => (prev?.id === session?.user?.id ? prev : (session?.user ?? null)))
      if (session?.user) checkFreeReset(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
