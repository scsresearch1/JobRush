import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ShieldCheckIcon, ChartBarIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'

const navClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-admin-700 text-white' : 'text-admin-100 hover:bg-admin-800/80'
  }`

export default function ContractLayout() {
  const { logout, contractSession } = useAuth()

  return (
    <div className="min-h-screen min-h-[100dvh] bg-admin-950 text-slate-100 flex flex-col">
      <header className="shrink-0 border-b border-admin-800 bg-admin-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-admin-800 ring-1 ring-admin-700/50 shrink-0">
              <ShieldCheckIcon className="w-6 h-6 text-admin-400" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white leading-tight">JobRush · Partner portal</p>
              <p className="text-xs text-admin-400 truncate">
                Signed in as {contractSession?.displayLabel || 'partner'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-admin-600 text-admin-200 text-sm font-medium hover:bg-admin-800"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full min-w-0">
        <aside className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-admin-800 bg-admin-900/50 lg:min-h-[200px]">
          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            <NavLink to="/contract" end className={navClass}>
              <ChartBarIcon className="w-5 h-5 shrink-0" />
              Coupon statistics
            </NavLink>
          </nav>
        </aside>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
