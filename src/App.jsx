import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import './styles/globals.css'

import Home from './pages/Home'
import { Login, Signup, ResetPassword } from './pages/Auth'
import Analyser from './pages/Analyser'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import UpdatePassword from './pages/UpdatePassword'
import ReportView from './pages/ReportView'
import Compare from './pages/Compare'

import { lazy, Suspense } from 'react'
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms   = lazy(() => import('./pages/Terms'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/"                    element={<Home />} />
            <Route path="/login"               element={<Login />} />
            <Route path="/signup"              element={<Signup />} />
            <Route path="/reset-password"      element={<ResetPassword />} />
            <Route path="/update-password"     element={<UpdatePassword />} />
            <Route path="/analyser"            element={<Analyser />} />
            <Route path="/privacy"             element={<Privacy />} />
            <Route path="/terms"               element={<Terms />} />
            <Route path="/dashboard"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin"               element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/report/:id"          element={<ProtectedRoute><ReportView /></ProtectedRoute>} />
            <Route path="/compare/:negotiationId" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="*"                    element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}