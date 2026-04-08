import { USERDB_FIELDS } from '../config/databaseSchema.js'
import { hasAppAccess } from './access.js'
import { QUOTA_ATS_MAX, QUOTA_MOCK_MAX } from './quotas.js'

/**
 * Map a Firebase userdb node to the shape stored in localStorage (`jobRush_user`).
 * @param {object} [priorLocal] — existing local user; preserves legacy `isAuthenticated` when Firebase has no accessStatus.
 */
export function mapFirebaseUserToLocal(data, uniqueId, priorLocal = {}) {
  if (!data || typeof data !== 'object') return {}
  const uid = uniqueId || data[USERDB_FIELDS.UNIQUE_ID]
  const statusFromFb = data[USERDB_FIELDS.ACCESS_STATUS]
  const hasExplicitStatus = statusFromFb !== undefined && statusFromFb !== null && statusFromFb !== ''
  return {
    uniqueId: uid,
    email: data[USERDB_FIELDS.EMAIL_ID] || '',
    accessStatus: hasExplicitStatus ? statusFromFb : priorLocal.accessStatus ?? null,
    suspended: data[USERDB_FIELDS.SUSPENDED] === true,
    atsChecksUsed: Number(data[USERDB_FIELDS.ATS_CHECKS_USED]) || 0,
    mockInterviewsUsed: Number(data[USERDB_FIELDS.MOCK_INTERVIEWS_USED]) || 0,
    isAuthenticated: hasExplicitStatus ? false : priorLocal.isAuthenticated === true,
  }
}

/**
 * After email submit: next step from Firebase row (returning user).
 */
export function computePostEmailFlow(firebaseRow) {
  if (!firebaseRow || typeof firebaseRow !== 'object') return { kind: 'payment_offer' }
  if (firebaseRow[USERDB_FIELDS.SUSPENDED] === true) return { kind: 'blocked_suspended' }

  const accessStatus = firebaseRow[USERDB_FIELDS.ACCESS_STATUS]
  const ats = Number(firebaseRow[USERDB_FIELDS.ATS_CHECKS_USED]) || 0
  const mock = Number(firebaseRow[USERDB_FIELDS.MOCK_INTERVIEWS_USED]) || 0

  if (accessStatus === 'awaiting_activation') return { kind: 'payment_confirmation' }
  if (accessStatus === 'pending_payment' || accessStatus == null || accessStatus === '') {
    return { kind: 'payment_offer' }
  }
  if (accessStatus === 'suspended') return { kind: 'repayment' }
  if (accessStatus === 'active') {
    if (ats >= QUOTA_ATS_MAX || mock >= QUOTA_MOCK_MAX) return { kind: 'repayment' }
    return { kind: 'app' }
  }
  return { kind: 'payment_offer' }
}

/**
 * "Start journey" from local user object (after optional refresh from Firebase).
 */
export function computeStartJourneyFlow(user) {
  if (!user || typeof user !== 'object') return { kind: 'email' }
  if (user.suspended === true) return { kind: 'blocked_suspended' }

  if (hasAppAccess(user)) {
    const ats = Number(user.atsChecksUsed) || 0
    const mock = Number(user.mockInterviewsUsed) || 0
    if (ats >= QUOTA_ATS_MAX || mock >= QUOTA_MOCK_MAX) {
      return { kind: 'repayment', email: user.email }
    }
    return { kind: 'app' }
  }
  if (user.accessStatus === 'awaiting_activation' && user.email) {
    return { kind: 'payment_confirmation', email: user.email }
  }
  if (user.accessStatus === 'suspended' && user.email) {
    return { kind: 'repayment', email: user.email }
  }
  if (user.accessStatus === 'pending_payment' && user.email) {
    return { kind: 'payment_offer', email: user.email }
  }
  return { kind: 'email' }
}
