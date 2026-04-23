import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ContractLayout from './components/ContractLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Reports from './pages/Reports'
import SettingsLayout from './pages/SettingsLayout'
import SettingsPassword from './pages/SettingsPassword'
import SettingsEmail from './pages/SettingsEmail'
import PaymentQr from './pages/PaymentQr'
import CouponStatus from './pages/CouponStatus'
import CouponManagement from './pages/CouponManagement'
import ContractManagement from './pages/ContractManagement'
import ContractCouponStats from './pages/ContractCouponStats'

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

function RequireAdmin() {
  const { ready, authenticated, role } = useAuth()
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
  if (role !== 'admin') {
    return <Navigate to="/contract" replace />
  }
  return <Outlet />
}

function RequireContract() {
  const { ready, authenticated, role } = useAuth()
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
  if (role !== 'contract') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

function RoleHomeRedirect() {
  const { role } = useAuth()
  if (role === 'contract') {
    return <Navigate to="/contract" replace />
  }
  return <Navigate to="/" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route path="contract" element={<RequireContract />}>
          <Route element={<ContractLayout />}>
            <Route index element={<ContractCouponStats />} />
          </Route>
        </Route>

        <Route element={<RequireAdmin />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="reports" element={<Reports />} />
            <Route path="payments/qr" element={<PaymentQr />} />
            <Route path="coupons/status" element={<CouponStatus />} />
            <Route path="coupons/manage" element={<CouponManagement />} />
            <Route path="contracts" element={<ContractManagement />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="password" replace />} />
              <Route path="password" element={<SettingsPassword />} />
              <Route path="email" element={<SettingsEmail />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<RoleHomeRedirect />} />
      </Route>
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
