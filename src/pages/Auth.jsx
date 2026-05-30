import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import styles from './Auth.module.css'

// ── Validation helpers ──
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePassword(password) {
  const errors = []
  if (password.length < 8)            errors.push('At least 8 characters')
  if (!/[A-Z]/.test(password))        errors.push('At least one uppercase letter')
  if (!/[0-9]/.test(password))        errors.push('At least one number')
  return errors
}

// ── Password strength indicator ──
function PasswordStrength({ password }) {
  if (!password) return null
  const errors = validatePassword(password)
  const score = 3 - errors.length
  const label = ['Weak', 'Fair', 'Good', 'Strong'][score]
  const color = ['#8b2020', '#b8975a', '#2a5c42', '#1a5c30'][score]

  return (
    <div className={styles.strengthWrap}>
      <div className={styles.strengthBars}>
        {[0,1,2].map(i => (
          <div
            key={i}
            className={styles.strengthBar}
            style={{ background: i < score ? color : 'var(--rule)' }}
          />
        ))}
      </div>
      <span className={styles.strengthLabel} style={{ color }}>{label}</span>
    </div>
  )
}

// ── Login ──
export function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  const validate = () => {
    const e = {}
    if (!validateEmail(email))   e.email    = 'Please enter a valid email address'
    if (!password)               e.password = 'Please enter your password'
    return e
  }

  const handleLogin = async (ev) => {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    setErrors({})
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErrors({ form: error.message }); setLoading(false) }
    else navigate('/dashboard')
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.kicker}>Welcome back</div>
          <h1 className={styles.h1}>Sign in to LeaseLens</h1>

          <button className={styles.googleBtn} onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
            Continue with Google
          </button>

          <div className={styles.divider}><span>or</span></div>

          <form onSubmit={handleLogin} className={styles.form} noValidate>
            <div className={styles.field}>
              <label>Email</label>
              <input
                className={`input ${errors.email ? styles.inputError : ''}`}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                placeholder="you@example.com"
              />
              {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
            </div>

            <div className={styles.field}>
              <label>Password</label>
              <input
                className={`input ${errors.password ? styles.inputError : ''}`}
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                placeholder="••••••••"
              />
              {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
            </div>

            {errors.form && <div className={styles.error}>{errors.form}</div>}

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className={styles.links}>
            <Link to="/reset-password">Forgot password?</Link>
            <span>·</span>
            <Link to="/signup">Create an account</Link>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Signup ──
export function Signup() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [errors, setErrors]         = useState({})
  const [success, setSuccess]       = useState(false)
  const [loading, setLoading]       = useState(false)

  const validate = () => {
    const e = {}
    if (!validateEmail(email))              e.email = 'Please enter a valid email address'
    const passErrors = validatePassword(password)
    if (passErrors.length)                  e.password = passErrors.join(' · ')
    if (password !== confirmPass)           e.confirmPass = 'Passwords do not match'
    return e
  }

  const handleSignup = async (ev) => {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    setErrors({})
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` }
    })
    if (error) { setErrors({ form: error.message }); setLoading(false) }
    else setSuccess(true)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.card}>
          {success ? (
            <>
              <div className={styles.kicker}>Almost there</div>
              <h1 className={styles.h1}>Check your email</h1>
              <p className={styles.confirmText}>
                We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
              </p>
            </>
          ) : (
            <>
              <div className={styles.kicker}>Get started</div>
              <h1 className={styles.h1}>Create your account</h1>

              <button className={styles.googleBtn} onClick={handleGoogle}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                Continue with Google
              </button>

              <div className={styles.divider}><span>or</span></div>

              <form onSubmit={handleSignup} className={styles.form} noValidate>
                <div className={styles.field}>
                  <label>Email</label>
                  <input
                    className={`input ${errors.email ? styles.inputError : ''}`}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                    placeholder="you@example.com"
                  />
                  {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                </div>

                <div className={styles.field}>
                  <label>Password</label>
                  <input
                    className={`input ${errors.password ? styles.inputError : ''}`}
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                    placeholder="8+ characters"
                  />
                  <PasswordStrength password={password} />
                  {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                </div>

                <div className={styles.field}>
                  <label>Confirm password</label>
                  <input
                    className={`input ${errors.confirmPass ? styles.inputError : ''}`}
                    type="password"
                    value={confirmPass}
                    onChange={e => { setConfirmPass(e.target.value); setErrors(p => ({ ...p, confirmPass: '' })) }}
                    placeholder="••••••••"
                  />
                  {errors.confirmPass && <span className={styles.fieldError}>{errors.confirmPass}</span>}
                </div>

                {errors.form && <div className={styles.error}>{errors.form}</div>}

                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </form>

              <div className={styles.links}>
                <Link to="/login">Already have an account? Sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Reset Password ──
export function ResetPassword() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const handleReset = async (ev) => {
    ev.preventDefault()
    if (!validateEmail(email)) { setErrors({ email: 'Please enter a valid email address' }); return }
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.card}>
          {sent ? (
            <>
              <div className={styles.kicker}>Check your email</div>
              <h1 className={styles.h1}>Reset link sent</h1>
              <p className={styles.confirmText}>
                If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
              </p>
            </>
          ) : (
            <>
              <div className={styles.kicker}>Account recovery</div>
              <h1 className={styles.h1}>Reset your password</h1>
              <form onSubmit={handleReset} className={styles.form} noValidate>
                <div className={styles.field}>
                  <label>Email address</label>
                  <input
                    className={`input ${errors.email ? styles.inputError : ''}`}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors({}) }}
                    placeholder="you@example.com"
                  />
                  {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                </div>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <div className={styles.links}><Link to="/login">Back to sign in</Link></div>
            </>
          )}
        </div>
      </div>
    </>
  )
}