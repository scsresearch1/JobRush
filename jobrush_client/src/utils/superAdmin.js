import { USERDB_FIELDS } from '../config/databaseSchema.js'

/** Known super admin — password required on Start Your Journey; unlimited quotas after auth. */
export const SUPER_ADMIN_EMAIL = 'sup_adm@jbrush.ai'

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function isSuperAdminEmail(email) {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL
}

export function isSuperAdminFirebaseRow(row) {
  if (!row || typeof row !== 'object') return false
  if (row[USERDB_FIELDS.IS_SUPER_ADMIN] === true || row.isSuperAdmin === true) return true
  return isSuperAdminEmail(row[USERDB_FIELDS.EMAIL_ID] || row.email)
}

export function isSuperAdminUser(user) {
  if (!user || typeof user !== 'object') return false
  if (user.isSuperAdmin === true) return true
  return isSuperAdminEmail(user.email)
}

export function hasUnlimitedQuota(user) {
  return isSuperAdminUser(user) && user.superAdminAuthenticated === true
}
