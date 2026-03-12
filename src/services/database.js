/**
 * JobRush - Database Service
 *
 * Centralized access to Firebase Realtime Database.
 * Import this in any page/component to read or write data.
 *
 * New fields/collections: add to scripts/create-firebase-collections.js first,
 * run the script, then update databaseSchema.js and this file.
 */

import { ref, set, get, push, update, remove } from 'firebase/database'
import { database } from '../config/firebase'
import { COLLECTIONS, USERDB_FIELDS, INTERVIEW_REPORTS_FIELDS } from '../config/databaseSchema'

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
export async function saveUser(uniqueId, emailId) {
  const userRefPath = userRef(uniqueId)
  const timestamp = new Date().toISOString()
  await set(userRefPath, {
    [USERDB_FIELDS.UNIQUE_ID]: uniqueId,
    [USERDB_FIELDS.EMAIL_ID]: emailId,
    [USERDB_FIELDS.TIMESTAMP]: timestamp,
  })
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
  const snapshot = await get(userdbRef())
  if (!snapshot.exists()) return null

  const users = snapshot.val()
  for (const [id, data] of Object.entries(users)) {
    if (id === '_schema' || !data) continue
    if (data[USERDB_FIELDS.EMAIL_ID] === emailId) {
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

/** Get reference to interviewReports collection */
export const interviewReportsRef = () => ref(database, COLLECTIONS.INTERVIEW_REPORTS)

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
    [INTERVIEW_REPORTS_FIELDS.GENERATED_AT]: report?.generatedAt || new Date().toISOString(),
  })
  return newRef.key
}

// Re-export schema for convenience
export { COLLECTIONS, USERDB_FIELDS, USERDB_SCHEMA } from '../config/databaseSchema'
