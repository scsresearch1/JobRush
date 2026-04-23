import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ChevronDownIcon,
  QrCodeIcon,
  KeyIcon,
  EnvelopeIcon,
  TicketIcon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'

const navClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-admin-700 text-white' : 'text-admin-100 hover:bg-admin-800/80'
  }`

const subNavClass = ({ isActive }) =>
  `flex items-center gap-3 pl-11 pr-4 py-2 rounded-lg text-sm transition ${
    isActive ? 'bg-admin-800 text-white font-medium' : 'text-admin-200 hover:bg-admin-800/60'
  }`

export default function Layout() {
  const { logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const [payOpen, setPayOpen] = useState(() => location.pathname.startsWith('/payments'))
  const [settingsOpen, setSettingsOpen] = useState(() => location.pathname.startsWith('/settings'))
  const [couponOpen, setCouponOpen] = useState(() => location.pathname.startsWith('/coupons'))

  useEffect(() => {
    if (location.pathname.startsWith('/payments')) setPayOpen(true)
    if (location.pathname.startsWith('/settings')) setSettingsOpen(true)
    if (location.pathname.startsWith('/coupons')) setCouponOpen(true)
  }, [location.pathname])

  return (
    <div className="min-h-screen min-h-[100dvh] bg-admin-950 text-slate-100 flex flex-col lg:flex-row">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[min(18rem,88vw)] max-w-[18rem] sm:w-64 bg-admin-900 border-r border-admin-800 transform transition-transform lg:translate-x-0 lg:static flex flex-col min-h-[100dvh] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-admin-800 shrink-0">
          <ShieldCheckIcon className="w-8 h-8 text-admin-400" />
          <div>
            <p className="font-bold text-white leading-tight">JobRush Admin</p>
            <p className="text-xs text-admin-300">Portal</p>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto pb-4">
          <NavLink to="/" end className={navClass} onClick={() => setMobileOpen(false)}>
            <HomeIcon className="w-5 h-5 shrink-0" />
            Dashboard
          </NavLink>
          <NavLink to="/users" className={navClass} onClick={() => setMobileOpen(false)}>
            <UsersIcon className="w-5 h-5 shrink-0" />
            User management
          </NavLink>
          <NavLink to="/reports" className={navClass} onClick={() => setMobileOpen(false)}>
            <DocumentTextIcon className="w-5 h-5 shrink-0" />
            Report management
          </NavLink>
          <NavLink to="/contracts" className={navClass} onClick={() => setMobileOpen(false)}>
            <BuildingOffice2Icon className="w-5 h-5 shrink-0" />
            Contract management
          </NavLink>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setPayOpen((o) => !o)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition text-left ${
                location.pathname.startsWith('/payments')
                  ? 'bg-admin-800/90 text-white'
                  : 'text-admin-100 hover:bg-admin-800/80'
              }`}
            >
              <BanknotesIcon className="w-5 h-5 shrink-0" />
              <span className="flex-1">Payment management</span>
              <ChevronDownIcon
                className={`w-4 h-4 shrink-0 transition-transform ${payOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {payOpen && (
              <div className="mt-0.5 space-y-0.5">
                <NavLink to="/payments/qr" className={subNavClass} onClick={() => setMobileOpen(false)}>
                  <QrCodeIcon className="w-4 h-4 shrink-0 opacity-80" />
                  Upload new QR code
                </NavLink>
              </div>
            )}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setCouponOpen((o) => !o)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition text-left ${
                location.pathname.startsWith('/coupons')
                  ? 'bg-admin-800/90 text-white'
                  : 'text-admin-100 hover:bg-admin-800/80'
              }`}
            >
              <TicketIcon className="w-5 h-5 shrink-0" />
              <span className="flex-1">Coupon management</span>
              <ChevronDownIcon
                className={`w-4 h-4 shrink-0 transition-transform ${couponOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {couponOpen && (
              <div className="mt-0.5 space-y-0.5">
                <NavLink to="/coupons/status" className={subNavClass} onClick={() => setMobileOpen(false)}>
                  <ClipboardDocumentListIcon className="w-4 h-4 shrink-0 opacity-80" />
                  Coupon status
                </NavLink>
                <NavLink to="/coupons/manage" className={subNavClass} onClick={() => setMobileOpen(false)}>
                  <TicketIcon className="w-4 h-4 shrink-0 opacity-80" />
                  Coupon management
                </NavLink>
              </div>
            )}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition text-left ${
                location.pathname.startsWith('/settings')
                  ? 'bg-admin-800/90 text-white'
                  : 'text-admin-100 hover:bg-admin-800/80'
              }`}
            >
              <Cog6ToothIcon className="w-5 h-5 shrink-0" />
              <span className="flex-1">Settings</span>
              <ChevronDownIcon
                className={`w-4 h-4 shrink-0 transition-transform ${settingsOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {settingsOpen && (
              <div className="mt-0.5 space-y-0.5">
                <NavLink to="/settings/password" className={subNavClass} onClick={() => setMobileOpen(false)}>
                  <KeyIcon className="w-4 h-4 shrink-0 opacity-80" />
                  Change password
                </NavLink>
                <NavLink to="/settings/email" className={subNavClass} onClick={() => setMobileOpen(false)}>
                  <EnvelopeIcon className="w-4 h-4 shrink-0 opacity-80" />
                  Email & sign-in
                </NavLink>
              </div>
            )}
          </div>
        </nav>
        <div className="shrink-0 p-3 border-t border-admin-800 bg-admin-900">
          <button
            type="button"
            onClick={() => {
              logout()
              setMobileOpen(false)
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-red-300 hover:bg-admin-800"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-14 shrink-0 py-2 bg-admin-900/80 border-b border-admin-800 flex items-center justify-between gap-3 px-3 sm:px-4 lg:px-8">
          <button
            type="button"
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-admin-200 hover:bg-admin-800"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
          <div className="flex-1 lg:flex-none" />
          <a
            href="https://jbrush.netlify.app"
            target="_blank"
            rel="noreferrer"
            className="text-xs sm:text-sm text-admin-300 hover:text-white text-right leading-snug max-w-[min(14rem,55vw)] truncate sm:max-w-none sm:whitespace-normal"
          >
            Open JobRush site →
          </a>
        </header>
        <main className="flex-1 p-3 sm:p-4 lg:p-8 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
