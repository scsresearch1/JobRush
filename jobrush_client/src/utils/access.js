/**
 * App access rules after introduction of payment verification.
 * Legacy users: isAuthenticated true and no accessStatus → full access.
 * New users: accessStatus must be 'active' (granted after payment verification / email).
 * Super admins: full access only after password verification on Start Your Journey.
 */

import { isSuperAdminUser } from './superAdmin.js'

export function hasAppAccess(user) {
  if (!user || typeof user !== 'object') return false
  if (isSuperAdminUser(user)) return user.superAdminAuthenticated === true
  if (user.suspended === true) return false
  if (user.accessStatus === 'active') return true
  if (user.accessStatus === 'suspended') return true
  if (user.isAuthenticated === true && user.accessStatus == null) return true
  return false
}
