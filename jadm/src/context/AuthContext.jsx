import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getAdminCredentials, saveAdminCredentials } from '../services/adminDb'

const SESSION_KEY = 'jadm_admin_session'
const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000 // 8 hours

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) {
        setAuthenticated(false)
        setReady(true)
        return
      }
      const { exp } = JSON.parse(raw)
      if (typeof exp === 'number' && Date.now() < exp) {
        setAuthenticated(true)
      } else {
        sessionStorage.removeItem(SESSION_KEY)
        setAuthenticated(false)
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
      setAuthenticated(false)
    }
    setReady(true)
  }, [])

  const login = useCallback(async (username, password) => {
    const u = String(username || '').trim()
    const p = String(password || '')
    if (!u || !p) {
      return { ok: false, error: 'Enter username and password.' }
    }
    try {
      const creds = await getAdminCredentials()
      if (!creds) {
        return {
          ok: false,
          error:
            'Admin credentials are missing in Firebase. From the project root run: npm run firebase:create-collections',
        }
      }
      if (creds.username !== u || creds.password !== p) {
        return { ok: false, error: 'Invalid username or password.' }
      }
      const exp = Date.now() + SESSION_EXPIRY_MS
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ exp }))
      setAuthenticated(true)
      return { ok: true }
    } catch (e) {
      console.error('[jadm] login', e)
      return { ok: false, error: 'Could not reach Firebase. Check config and network.' }
    }
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const cur = String(currentPassword || '')
    const next = String(newPassword || '')
    if (!cur || !next) {
      return { ok: false, error: 'Fill in all password fields.' }
    }
    if (next.length < 8) {
      return { ok: false, error: 'New password must be at least 8 characters.' }
    }
    try {
      const creds = await getAdminCredentials()
      if (!creds) {
        return { ok: false, error: 'Admin credentials are missing in Firebase.' }
      }
      if (creds.password !== cur) {
        return { ok: false, error: 'Current password is incorrect.' }
      }
      await saveAdminCredentials({ username: creds.username, password: next })
      return { ok: true }
    } catch (e) {
      console.error('[jadm] changePassword', e)
      return { ok: false, error: 'Could not update password. Check Firebase rules and network.' }
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider value={{ ready, authenticated, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
