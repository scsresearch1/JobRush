/**
 * JobRush.ai - Firebase Realtime Database Schema
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
  /** Stored ATS compatibility runs (one push per successful client analysis) */
  ATS_REPORTS: 'atsReports',
  COUPONS: 'coupons',
  COUPON_REDEMPTIONS: 'couponRedemptions',
  ADMIN_PORTAL: 'adminPortal',
}

/** Single document at adminPortal/credentials — used by admin portal login */
export const ADMIN_PORTAL_FIELDS = {
  USERNAME: 'username',
  PASSWORD: 'password',
}

export const ADMIN_PORTAL_KEYS = {
  PAYMENT_QR: 'paymentQr',
}

/** Public-facing payment QR image (data URL or https), set from admin portal */
export const PAYMENT_QR_FIELDS = {
  QR_IMAGE_URL: 'qrImageUrl',
}

export const COUPON_FIELDS = {
  COUPON_CODE: 'couponCode',
  CONTRACT_NAME: 'contractName',
  DISCOUNT_AMOUNT: 'discountAmount',
  CONTRACT_PAYMENT_PER_USER: 'contractPaymentPerUser',
  VALIDITY_DAYS: 'validityDays',
  VALID_UNTIL: 'validUntil',
  IS_ACTIVE: 'isActive',
}

// =============================================================================
// USERDB - User collection
// Fields: UniqueID, EmailID, Timestamp
// =============================================================================

export const USERDB_FIELDS = {
  UNIQUE_ID: 'UniqueID',
  EMAIL_ID: 'EmailID',
  TIMESTAMP: 'Timestamp',
  /** Client access gate; synced from app for admin reporting */
  ACCESS_STATUS: 'accessStatus',
  LAST_SEEN_AT: 'lastSeenAt',
  PAYMENT_REFERENCE: 'paymentReference',
  ACCESS_REQUESTED_AT: 'accessRequestedAt',
  COUPON_CODE_PENDING: 'couponCodePending',
  /** When true, user cannot use the app (set from admin) */
  SUSPENDED: 'suspended',
  /** Count of ATS compatibility runs used (max 5) */
  ATS_CHECKS_USED: 'atsChecksUsed',
  /** Count of mock interview reports saved (max 5) */
  MOCK_INTERVIEWS_USED: 'mockInterviewsUsed',
}

export const USERDB_SCHEMA = {
  collection: COLLECTIONS.USERDB,
  fields: [
    USERDB_FIELDS.UNIQUE_ID,
    USERDB_FIELDS.EMAIL_ID,
    USERDB_FIELDS.TIMESTAMP,
    USERDB_FIELDS.ACCESS_STATUS,
    USERDB_FIELDS.LAST_SEEN_AT,
    USERDB_FIELDS.PAYMENT_REFERENCE,
    USERDB_FIELDS.ACCESS_REQUESTED_AT,
    USERDB_FIELDS.COUPON_CODE_PENDING,
    USERDB_FIELDS.SUSPENDED,
    USERDB_FIELDS.ATS_CHECKS_USED,
    USERDB_FIELDS.MOCK_INTERVIEWS_USED,
  ],
  description: 'User collection; optional access and presence fields synced from the app for admin reporting',
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
// ATS REPORTS - One row per ATS analysis saved from the client
// Fields: userId, report (serializable summary), generatedAt
// =============================================================================

export const ATS_REPORT_FIELDS = {
  USER_ID: 'userId',
  REPORT: 'report',
  GENERATED_AT: 'generatedAt',
}

// =============================================================================
// DATABASE URL (for reference - actual URL is in firebase.js config)
// =============================================================================

export { JOBBRUSH_REALTIME_DATABASE_URL as DATABASE_URL } from './firebaseJobbrushDefaults.js'
