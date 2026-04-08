/**
 * JobRush.ai - Database Service
 *
 * Centralized access to Firebase Realtime Database.
 * Import this in any page/component to read or write data.
 *
 * New fields/collections: add to scripts/create-firebase-collections.js first,
 * run the script, then update databaseSchema.js and this file.
 */

import { ref, set, get, push, update, remove } from 'firebase/database'
import { database } from '../config/firebase'
import { COLLECTIONS, USERDB_FIELDS, INTERVIEW_REPORTS_FIELDS, ATS_REPORT_FIELDS } from '../config/databaseSchema'
import { getISTTimestamp } from '../utils/timestamp.js'
import { QUOTA_ATS_MAX, QUOTA_MOCK_MAX } from '../utils/quotas.js'

// =============================================================================
// REFERENCE HELPERS
// =============================================================================

/** Get reference to userdb collection */
export const userdbRef = () => ref(database, COLLECTIONS.USERDB)

/** Get reference to a specific user by UniqueID */
export const userRef = (uniqueId) => ref(database, `${COLLECTIONS.USERDB}/${uniqueId}`)

// =============================================================================
// USERDB OPERATIONS
// =============================================================================

/**
 * Add or update a user in userdb
 * @param {string} uniqueId - Unique identifier for the user
 * @param {string} emailId - User's email
 * @returns {Promise<void>}
 */
function isFirebaseBackedUserId(uniqueId) {
  return Boolean(uniqueId) && !String(uniqueId).startsWith('local_')
}

/**
 * @param {Record<string, unknown>} [extra] — optional fields merged into the user node (e.g. accessStatus, lastSeenAt)
 */
export async function saveUser(uniqueId, emailId, extra = {}) {
  const userRefPath = userRef(uniqueId)
  const timestamp = getISTTimestamp()
  await set(userRefPath, {
    [USERDB_FIELDS.UNIQUE_ID]: uniqueId,
    [USERDB_FIELDS.EMAIL_ID]: emailId,
    [USERDB_FIELDS.TIMESTAMP]: timestamp,
    ...extra,
  })
}

/**
 * Merges access / presence fields into userdb for admin dashboards (no-op for local-only IDs).
 */
export async function syncUserFieldsToFirebase(uniqueId, partial) {
  if (!isFirebaseBackedUserId(uniqueId)) return
  const patch = {}
  if (partial.accessStatus !== undefined) patch[USERDB_FIELDS.ACCESS_STATUS] = partial.accessStatus
  if (partial.paymentReference !== undefined) patch[USERDB_FIELDS.PAYMENT_REFERENCE] = partial.paymentReference
  if (partial.accessRequestedAt !== undefined) patch[USERDB_FIELDS.ACCESS_REQUESTED_AT] = partial.accessRequestedAt
  if (partial.couponCodePending !== undefined) patch[USERDB_FIELDS.COUPON_CODE_PENDING] = partial.couponCodePending
  if (partial.lastSeenAt !== undefined) patch[USERDB_FIELDS.LAST_SEEN_AT] = partial.lastSeenAt
  if (Object.keys(patch).length === 0) return
  await update(userRef(uniqueId), patch)
}

export async function touchUserLastSeen(uniqueId) {
  if (!isFirebaseBackedUserId(uniqueId)) return
  await update(userRef(uniqueId), { [USERDB_FIELDS.LAST_SEEN_AT]: new Date().toISOString() })
}

export async function incrementAtsCheckUsage(uniqueId) {
  if (!isFirebaseBackedUserId(uniqueId)) return
  const snapshot = await get(userRef(uniqueId))
  const prev = snapshot.exists() ? snapshot.val() : {}
  const cur = Number(prev[USERDB_FIELDS.ATS_CHECKS_USED]) || 0
  const next = Math.min(QUOTA_ATS_MAX, cur + 1)
  await update(userRef(uniqueId), { [USERDB_FIELDS.ATS_CHECKS_USED]: next })
  await syncQuotaSuspendedStatus(uniqueId)
}

export async function incrementMockInterviewUsage(uniqueId) {
  if (!isFirebaseBackedUserId(uniqueId)) return
  const snapshot = await get(userRef(uniqueId))
  const prev = snapshot.exists() ? snapshot.val() : {}
  const cur = Number(prev[USERDB_FIELDS.MOCK_INTERVIEWS_USED]) || 0
  const next = Math.min(QUOTA_MOCK_MAX, cur + 1)
  await update(userRef(uniqueId), { [USERDB_FIELDS.MOCK_INTERVIEWS_USED]: next })
  await syncQuotaSuspendedStatus(uniqueId)
}

/**
 * Marks user status as suspended when plan quota is exhausted (ATS or Mock).
 * Uses accessStatus string to avoid hard account blocking (`suspended: true` is still admin-only hard block).
 */
export async function syncQuotaSuspendedStatus(uniqueId) {
  if (!isFirebaseBackedUserId(uniqueId)) return false
  const snapshot = await get(userRef(uniqueId))
  const prev = snapshot.exists() ? snapshot.val() : {}
  const ats = Number(prev[USERDB_FIELDS.ATS_CHECKS_USED]) || 0
  const mock = Number(prev[USERDB_FIELDS.MOCK_INTERVIEWS_USED]) || 0
  const exhausted = ats >= QUOTA_ATS_MAX || mock >= QUOTA_MOCK_MAX
  const currentStatus = String(prev[USERDB_FIELDS.ACCESS_STATUS] || '').trim().toLowerCase()
  if (exhausted && currentStatus === 'active') {
    await update(userRef(uniqueId), { [USERDB_FIELDS.ACCESS_STATUS]: 'suspended' })
  }
  return exhausted
}

/**
 * Get a user by UniqueID
 * @param {string} uniqueId - Unique identifier for the user
 * @returns {Promise<{UniqueID: string, EmailID: string} | null>}
 */
export async function getUser(uniqueId) {
  const snapshot = await get(userRef(uniqueId))
  return snapshot.exists() ? snapshot.val() : null
}

/**
 * Get user by EmailID (scans userdb - use sparingly)
 * @param {string} emailId - User's email to search for
 * @returns {Promise<{uniqueId: string, data: object} | null>}
 */
export async function getUserByEmail(emailId) {
  const needle = String(emailId || '').trim().toLowerCase()
  if (!needle) return null

  const snapshot = await get(userdbRef())
  if (!snapshot.exists()) return null

  const users = snapshot.val()
  for (const [id, data] of Object.entries(users)) {
    if (id === '_schema' || !data) continue
    const stored = String(data[USERDB_FIELDS.EMAIL_ID] || '').trim().toLowerCase()
    if (stored === needle) {
      return { uniqueId: id, data }
    }
  }
  return null
}

/**
 * Get all users from userdb
 * @returns {Promise<Record<string, {UniqueID: string, EmailID: string}>>}
 */
export async function getAllUsers() {
  const snapshot = await get(userdbRef())
  return snapshot.exists() ? snapshot.val() : {}
}

/**
 * Delete a user by UniqueID
 * @param {string} uniqueId - Unique identifier for the user
 * @returns {Promise<void>}
 */
export async function deleteUser(uniqueId) {
  await remove(userRef(uniqueId))
}

// =============================================================================
// INTERVIEW REPORTS
// =============================================================================

/** Serializable ATS payload for Firebase (avoids huge evidence / normalized blobs). */
export function buildStorableAtsReport(evaluation) {
  if (!evaluation) return null
  const generatedAt = new Date().toISOString()
  return {
    version: 1,
    kind: 'ats_compatibility',
    generatedAt,
    summary: evaluation.summary,
    scores: {
      all: (evaluation.scores?.all || []).map((s) => ({
        entity: s.entity,
        type: s.type,
        score: s.score,
        raw_score: s.raw_score,
      })),
    },
  }
}

/** Get reference to interviewReports collection */
export const interviewReportsRef = () => ref(database, COLLECTIONS.INTERVIEW_REPORTS)

export const atsReportsRef = () => ref(database, COLLECTIONS.ATS_REPORTS)

/**
 * Save a behavioral report to Firebase
 * @param {string} userId - User unique ID (or 'anonymous' if not logged in)
 * @param {Object} report - Full behavioral report from buildBehavioralReport
 * @param {Array} recommendations - LLM-generated tips
 * @returns {Promise<string>} The pushed report ID
 */
export async function saveInterviewReport(userId, report, recommendations = []) {
  const reportsRef = interviewReportsRef()
  const newRef = push(reportsRef)
  await set(newRef, {
    [INTERVIEW_REPORTS_FIELDS.USER_ID]: userId || 'anonymous',
    [INTERVIEW_REPORTS_FIELDS.REPORT]: report,
    [INTERVIEW_REPORTS_FIELDS.RECOMMENDATIONS]: recommendations,
    [INTERVIEW_REPORTS_FIELDS.GENERATED_AT]: report?.generatedAt || getISTTimestamp(),
  })
  return newRef.key
}

/**
 * Persist one ATS analysis run (paired with incrementing atsChecksUsed on the client).
 * @param {string} userId
 * @param {object} reportPayload — from buildStorableAtsReport()
 */
export async function saveAtsReport(userId, reportPayload) {
  const root = atsReportsRef()
  const newRef = push(root)
  const generatedAt = reportPayload?.generatedAt || getISTTimestamp()
  await set(newRef, {
    [ATS_REPORT_FIELDS.USER_ID]: userId || 'anonymous',
    [ATS_REPORT_FIELDS.REPORT]: reportPayload,
    [ATS_REPORT_FIELDS.GENERATED_AT]: generatedAt,
  })
  return newRef.key
}

// Re-export schema for convenience
export { COLLECTIONS, USERDB_FIELDS, USERDB_SCHEMA } from '../config/databaseSchema'
