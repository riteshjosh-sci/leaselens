import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/admin/login" replace />
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/admin/login" replace />

  return children
}
