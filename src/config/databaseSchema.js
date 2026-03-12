/**
 * JobRush - Firebase Realtime Database Schema
 *
 * Use these constants when reading/writing from any page.
 *
 * IMPORTANT: Keep in sync with scripts/create-firebase-collections.js
 * When adding new fields/collections: add them to the create script first,
 * run npm run firebase:create-collections, then update this file to match.
 */

// =============================================================================
// COLLECTIONS (NODES)
// =============================================================================

export const COLLECTIONS = {
  USERDB: 'userdb',
  INTERVIEW_REPORTS: 'interviewReports',
}

// =============================================================================
// USERDB - User collection
// Fields: UniqueID, EmailID, Timestamp
// =============================================================================

export const USERDB_FIELDS = {
  UNIQUE_ID: 'UniqueID',
  EMAIL_ID: 'EmailID',
  TIMESTAMP: 'Timestamp',
}

export const USERDB_SCHEMA = {
  collection: COLLECTIONS.USERDB,
  fields: [USERDB_FIELDS.UNIQUE_ID, USERDB_FIELDS.EMAIL_ID, USERDB_FIELDS.TIMESTAMP],
  description: 'User collection - documents have UniqueID, EmailID, and Timestamp',
}

// =============================================================================
// INTERVIEW REPORTS - Behavioral report storage
// Fields: userId, report, recommendations, generatedAt
// =============================================================================

export const INTERVIEW_REPORTS_FIELDS = {
  USER_ID: 'userId',
  REPORT: 'report',
  RECOMMENDATIONS: 'recommendations',
  GENERATED_AT: 'generatedAt',
}

// =============================================================================
// DATABASE URL (for reference - actual URL is in firebase.js config)
// =============================================================================

export const DATABASE_URL = 'https://jobrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app'
