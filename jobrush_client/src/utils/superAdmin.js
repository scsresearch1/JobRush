/** Super admin accounts bypass payment gates and usage quotas. */

export function isSuperAdminUser(user) {
  if (!user || typeof user !== 'object') return false
  return user.isSuperAdmin === true
}

export function hasUnlimitedQuota(user) {
  return isSuperAdminUser(user)
}
