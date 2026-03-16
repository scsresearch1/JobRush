import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BriefcaseIcon, HomeIcon, UserIcon, VideoCameraIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { pingHealth } from '../services/groqService.js'

const Layout = ({ children }) => {
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    pingHealth(9, 10000).catch(() => {})
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
    { to: '/resume-upload', label: 'Resume', icon: BriefcaseIcon },
    { to: '/mock-interview', label: 'Mock Interview', icon: VideoCameraIcon },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center">
                <BriefcaseIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl sm:text-2xl font-bold gradient-text">JobRush</span>
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              {user?.isAuthenticated && (
                <>
                  {navLinks.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                        location.pathname === to
                          ? 'bg-primary-100 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </Link>
                  ))}
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 text-gray-700 hover:text-primary-600"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span className="max-w-[120px] truncate">{user?.name || user?.email || 'Profile'}</span>
                  </Link>
                </>
              )}
            </div>
            {user?.isAuthenticated && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
              </button>
            )}
          </div>
          {user?.isAuthenticated && mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200 flex flex-col gap-1">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
                    location.pathname === to ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              ))}
              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                <UserIcon className="w-5 h-5" />
                {user?.name || user?.email || 'Profile'}
              </Link>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}

export default Layout
