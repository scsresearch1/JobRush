import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { isFirebaseWebConfigReady } from '../config/firebase'
import { getAdminCredentials, saveAdminCredentials, saveAdminUsernameOnly } from '../services/adminDb'

const SESSION_KEY = 'jadm_admin_session'
const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000 // 8 hours

const AuthContext = createContext(null)

export function messageForFirebaseError(err) {
  const code = err?.code || ''
  const msg = String(err?.message || '')
  if (
    code === 'permission_denied' ||
    code === 'PERMISSION_DENIED' ||
    msg.includes('permission_denied') ||
    msg.includes('Permission denied')
  ) {
    return 'Firebase blocked read access to admin credentials. In Realtime Database → Rules, allow read (and write for password changes) on adminPortal/credentials for your setup, then try again.'
  }
  if (code === 'unavailable' || msg.includes('network') || msg.includes('Network')) {
    return 'Firebase is unreachable. Check your connection and try again.'
  }
  if (!isFirebaseWebConfigReady()) {
    return 'Firebase web config is missing (VITE_FIREBASE_API_KEY). Add the same VITE_FIREBASE_* variables you use for the main app to Netlify → Site settings → Environment variables, then trigger a new deploy.'
  }
  return 'Could not load admin credentials from Firebase. Check the browser console, Netlify env vars, and database rules.'
}

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
      return { ok: false, error: messageForFirebaseError(e) }
    }
  }, [])

  const changeAdminUsername = useCallback(async (currentPassword, newUsername) => {
    const cur = String(currentPassword || '')
    const next = String(newUsername || '').trim()
    if (!cur || !next) {
      return { ok: false, error: 'Enter your current password and the new username.' }
    }
    try {
      const creds = await getAdminCredentials()
      if (!creds) {
        return { ok: false, error: 'Admin credentials are missing in Firebase.' }
      }
      if (creds.password !== cur) {
        return { ok: false, error: 'Current password is incorrect.' }
      }
      await saveAdminUsernameOnly(next)
      return { ok: true }
    } catch (e) {
      console.error('[jadm] changeAdminUsername', e)
      return { ok: false, error: messageForFirebaseError(e) }
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
      return { ok: false, error: messageForFirebaseError(e) }
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthenticated(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{ ready, authenticated, login, logout, changePassword, changeAdminUsername }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
