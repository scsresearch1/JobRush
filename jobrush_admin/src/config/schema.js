/** Mirror of main app databaseSchema — keep in sync */
export const COLLECTIONS = {
  USERDB: 'userdb',
  INTERVIEW_REPORTS: 'interviewReports',
  ATS_REPORTS: 'atsReports',
  ADMIN_PORTAL: 'adminPortal',
}

export const ADMIN_PORTAL_KEYS = {
  CREDENTIALS: 'credentials',
  PAYMENT_QR: 'paymentQr',
}

export const ADMIN_PORTAL_FIELDS = {
  USERNAME: 'username',
  PASSWORD: 'password',
  /** Data URL or https URL for UPI QR shown on the client payment modal */
  QR_IMAGE_URL: 'qrImageUrl',
}

export const USERDB_FIELDS = {
  UNIQUE_ID: 'UniqueID',
  EMAIL_ID: 'EmailID',
  TIMESTAMP: 'Timestamp',
  ACCESS_STATUS: 'accessStatus',
  LAST_SEEN_AT: 'lastSeenAt',
  PAYMENT_REFERENCE: 'paymentReference',
  ACCESS_REQUESTED_AT: 'accessRequestedAt',
  COUPON_CODE_PENDING: 'couponCodePending',
  SUSPENDED: 'suspended',
  ATS_CHECKS_USED: 'atsChecksUsed',
  MOCK_INTERVIEWS_USED: 'mockInterviewsUsed',
}

export const INTERVIEW_REPORTS_FIELDS = {
  USER_ID: 'userId',
  REPORT: 'report',
  RECOMMENDATIONS: 'recommendations',
  GENERATED_AT: 'generatedAt',
}

export const ATS_REPORT_FIELDS = {
  USER_ID: 'userId',
  REPORT: 'report',
  GENERATED_AT: 'generatedAt',
}
