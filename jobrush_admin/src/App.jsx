import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Reports from './pages/Reports'
import SettingsLayout from './pages/SettingsLayout'
import SettingsPassword from './pages/SettingsPassword'
import SettingsEmail from './pages/SettingsEmail'
import PaymentQr from './pages/PaymentQr'

function ProtectedRoute({ children }) {
  const { ready, authenticated } = useAuth()
  if (!ready) {
    return (
      <div className="min-h-screen bg-admin-950 flex items-center justify-center text-admin-300">
        Loading…
      </div>
    )
  }
  if (!authenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="reports" element={<Reports />} />
        <Route path="payments/qr" element={<PaymentQr />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="password" replace />} />
          <Route path="password" element={<SettingsPassword />} />
          <Route path="email" element={<SettingsEmail />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const BASENAME = '/jadm'

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
