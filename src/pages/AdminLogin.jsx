import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './AdminLogin.module.css'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

export default function AdminLogin() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (email !== ADMIN_EMAIL) {
      setError('Access denied.')
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid credentials.')
      setLoading(false)
    } else {
      navigate('/admin')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>Lease<em>Lens</em></div>
        <div className={styles.tag}>Admin access</div>

        <form onSubmit={handleLogin} className={styles.form} noValidate>
          <div className={styles.field}>
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="admin@leaselens.au"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="••••••••"
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in to admin'}
          </button>
        </form>

        <a href="/" className={styles.backLink}>← Back to site</a>
      </div>
    </div>
  )
}
