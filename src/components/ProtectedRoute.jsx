import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  // Wait for Supabase to finish loading the session
  if (loading) return null

  // Not logged in — redirect to login
  if (!user) return <Navigate to="/login" replace />

  return children
}
