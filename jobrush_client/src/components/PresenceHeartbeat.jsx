import { useEffect } from 'react'
import { touchUserLastSeen } from '../services/database.js'

/**
 * Keeps lastSeenAt fresh in Firebase for signed-in JobRush users so the admin dashboard can show approximate online counts.
 */
export default function PresenceHeartbeat() {
  useEffect(() => {
    const pulse = () => {
      try {
        const raw = localStorage.getItem('jobRush_user')
        if (!raw) return
        const u = JSON.parse(raw)
        if (!u?.uniqueId) return
        touchUserLastSeen(u.uniqueId).catch(() => {})
      } catch {
        /* ignore */
      }
    }
    pulse()
    const id = window.setInterval(pulse, 45_000)
    return () => window.clearInterval(id)
  }, [])
  return null
}
