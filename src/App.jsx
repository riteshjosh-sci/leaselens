import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import FeedbackWidget from './components/FeedbackWidget'
import './styles/globals.css'

import Home from './pages/Home'
import { Login, Signup, ResetPassword } from './pages/Auth'
import Analyser from './pages/Analyser'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import UpdatePassword from './pages/UpdatePassword'
import ReportView from './pages/ReportView'
import Compare from './pages/Compare'
import Pricing from './pages/Pricing'

// Admin — completely isolated
import AdminLogin from './pages/AdminLogin'
import Admin from './pages/Admin'
import AdminReportView from './pages/AdminReportView'

import { lazy, Suspense } from 'react'
const Privacy             = lazy(() => import('./pages/Privacy'))
const Terms               = lazy(() => import('./pages/Terms'))
const WorkspaceSettings   = lazy(() => import('./pages/WorkspaceSettings'))
const Profile             = lazy(() => import('./pages/Profile'))
const SharedReport        = lazy(() => import('./pages/SharedReport'))
const WorkspacePage       = lazy(() => import('./pages/WorkspacePage'))
const NegotiationDetail   = lazy(() => import('./pages/NegotiationDetail'))
const Properties          = lazy(() => import('./pages/Properties'))
const Negotiations        = lazy(() => import('./pages/Negotiations'))

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={null}>
            <Routes>
              {/* ── Public routes ── */}
              <Route path="/"                       element={<Home />} />
              <Route path="/login"                  element={<Login />} />
              <Route path="/signup"                 element={<Signup />} />
              <Route path="/reset-password"         element={<ResetPassword />} />
              <Route path="/update-password"        element={<UpdatePassword />} />
              <Route path="/analyser"               element={<Analyser />} />
              <Route path="/pricing"                element={<Pricing />} />
              <Route path="/privacy"                element={<Privacy />} />
              <Route path="/terms"                  element={<Terms />} />
              <Route path="/shared/:token"          element={<SharedReport />} />

              {/* ── User protected routes ── */}
              <Route path="/dashboard"              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/properties"             element={<ProtectedRoute><Properties /></ProtectedRoute>} />
              <Route path="/negotiations"           element={<ProtectedRoute><Negotiations /></ProtectedRoute>} />
              <Route path="/profile"                element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/report/:id"             element={<ProtectedRoute><ReportView /></ProtectedRoute>} />
              <Route path="/compare/:negotiationId" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
              <Route path="/workspace/:id"          element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
              <Route path="/workspace/:id/settings" element={<ProtectedRoute><WorkspaceSettings /></ProtectedRoute>} />
              <Route path="/negotiation/:id"        element={<ProtectedRoute><NegotiationDetail /></ProtectedRoute>} />

              {/* ── Admin routes — completely isolated ── */}
              <Route path="/admin/login"            element={<AdminLogin />} />
              <Route path="/admin"                  element={<AdminRoute><Admin /></AdminRoute>} />
              <Route path="/admin/report/:documentId" element={<AdminRoute><AdminReportView /></AdminRoute>} />

              <Route path="*"                       element={<NotFound />} />
            </Routes>
          </Suspense>
          <FeedbackWidget />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
