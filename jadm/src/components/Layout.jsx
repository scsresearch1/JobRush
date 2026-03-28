import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'

const navClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-admin-700 text-white' : 'text-admin-100 hover:bg-admin-800/80'
  }`

export default function Layout() {
  const { logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-admin-950 text-slate-100 flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-admin-900 border-r border-admin-800 transform transition-transform lg:translate-x-0 lg:static ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-admin-800">
          <ShieldCheckIcon className="w-8 h-8 text-admin-400" />
          <div>
            <p className="font-bold text-white leading-tight">JobRush Admin</p>
            <p className="text-xs text-admin-300">Portal</p>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          <NavLink to="/" end className={navClass} onClick={() => setMobileOpen(false)}>
            <HomeIcon className="w-5 h-5 shrink-0" />
            Dashboard
          </NavLink>
          <NavLink to="/users" className={navClass} onClick={() => setMobileOpen(false)}>
            <UsersIcon className="w-5 h-5 shrink-0" />
            Users
          </NavLink>
          <NavLink to="/reports" className={navClass} onClick={() => setMobileOpen(false)}>
            <DocumentTextIcon className="w-5 h-5 shrink-0" />
            Interview reports
          </NavLink>
          <NavLink to="/settings" className={navClass} onClick={() => setMobileOpen(false)}>
            <Cog6ToothIcon className="w-5 h-5 shrink-0" />
            Settings
          </NavLink>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-admin-800">
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
        <header className="h-16 bg-admin-900/80 border-b border-admin-800 flex items-center justify-between px-4 lg:px-8">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-admin-200 hover:bg-admin-800"
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
            className="text-sm text-admin-300 hover:text-white"
          >
            Open JobRush site →
          </a>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
