import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'leaseroom-theme'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'dark' || stored === 'light' ? stored : 'light'
    } catch {
      return 'light'
    }
  })
  // Tracks the signed-in user so toggleTheme can persist to their profile.
  // ThemeProvider sits above AuthProvider in App.jsx, so it can't use
  // useAuth() -- it reads the session directly, same pattern Nav.jsx and
  // AppSidebar.jsx already use for their own profile fetches.
  const userIdRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }, [theme])

  useEffect(() => {
    const applySavedPreference = async (userId) => {
      userIdRef.current = userId
      const { data } = await supabase.from('profiles').select('theme_preference').eq('id', userId).single()
      if (data?.theme_preference === 'dark' || data?.theme_preference === 'light') {
        setTheme(data.theme_preference)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) applySavedPreference(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) applySavedPreference(session.user.id)
      if (event === 'SIGNED_OUT') userIdRef.current = null
    })
    return () => subscription.unsubscribe()
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (userIdRef.current) {
      supabase.from('profiles').update({ theme_preference: next }).eq('id', userIdRef.current).then(() => {})
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
