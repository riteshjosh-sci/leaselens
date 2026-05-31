import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import styles from './Auth.module.css'

export default function UpdatePassword() {
  const [password, setPassword]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [errors, setErrors]         = useState({})
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)
  const navigate = useNavigate()

  // Supabase sends the user back with a session after clicking reset link
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User is now in password recovery mode — form is ready
      }
    })
  }, [])

  const validate = () => {
    const e = {}
    if (password.length < 8)          e.password    = 'At least 8 characters'
    if (!/[A-Z]/.test(password))      e.password    = 'At least one uppercase letter required'
    if (!/[0-9]/.test(password))      e.password    = 'At least one number required'
    if (password !== confirmPass)     e.confirmPass = 'Passwords do not match'
    return e
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    setErrors({})
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setErrors({ form: error.message })
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    }
  }

  return (
    <>
      <Nav />
      <div className={styles.page}>
        <div className={styles.card}>
          {success ? (
            <>
              <div className={styles.kicker}>All done</div>
              <h1 className={styles.h1}>Password updated</h1>
              <p className={styles.confirmText}>
                Your password has been changed successfully. Redirecting you to your dashboard...
              </p>
            </>
          ) : (
            <>
              <div className={styles.kicker}>Account security</div>
              <h1 className={styles.h1}>Set new password</h1>

              <form onSubmit={handleUpdate} className={styles.form} noValidate>
                <div className={styles.field}>
                  <label>New password</label>
                  <input
                    className={`input ${errors.password ? styles.inputError : ''}`}
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                    placeholder="8+ characters"
                    autoFocus
                  />
                  {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                </div>

                <div className={styles.field}>
                  <label>Confirm new password</label>
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

                <button
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
