/** Mirror of main app databaseSchema — keep in sync */
export const COLLECTIONS = {
  USERDB: 'userdb',
  INTERVIEW_REPORTS: 'interviewReports',
  ATS_REPORTS: 'atsReports',
  ADMIN_PORTAL: 'adminPortal',
  COUPONS: 'coupons',
  COUPON_REDEMPTIONS: 'couponRedemptions',
}

export const ADMIN_PORTAL_KEYS = {
  CREDENTIALS: 'credentials',
  PAYMENT_QR: 'paymentQr',
  /** SMTP + From address for payment / user emails (API reads RTDB; URL default in server/index.js) */
  EMAIL_OUTBOUND: 'emailOutbound',
  /** External contract partners: login on jadm, see only assigned coupon stats */
  CONTRACT_ACCOUNTS: 'contractAccounts',
}

/** Stored at adminPortal/emailOutbound */
export const EMAIL_OUTBOUND_FIELDS = {
  MAIL_FROM: 'mailFrom',
  SMTP_HOST: 'smtpHost',
  SMTP_PORT: 'smtpPort',
  SMTP_SECURE: 'smtpSecure',
  SMTP_USER: 'smtpUser',
  SMTP_PASS: 'smtpPass',
  UPDATED_AT: 'updatedAt',
}

export const ADMIN_PORTAL_FIELDS = {
  USERNAME: 'username',
  PASSWORD: 'password',
  /** Data URL or https URL for UPI QR shown on the client payment modal */
  QR_IMAGE_URL: 'qrImageUrl',
}

/** One row per partner under adminPortal/contractAccounts/{pushId} */
export const CONTRACT_ACCOUNT_FIELDS = {
  USERNAME: 'username',
  PASSWORD: 'password',
  DISPLAY_NAME: 'displayName',
  /** Coupon codes this partner may view (array or RTDB numeric-key object) */
  COUPON_CODES: 'couponCodes',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
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

export const COUPON_FIELDS = {
  COUPON_CODE: 'couponCode',
  CONTRACT_NAME: 'contractName',
  DISCOUNT_AMOUNT: 'discountAmount',
  CONTRACT_PAYMENT_PER_USER: 'contractPaymentPerUser',
  VALIDITY_DAYS: 'validityDays',
  VALID_UNTIL: 'validUntil',
  IS_ACTIVE: 'isActive',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
}

export const COUPON_REDEMPTION_FIELDS = {
  COUPON_CODE: 'couponCode',
  CONTRACT_NAME: 'contractName',
  DISCOUNT_AMOUNT: 'discountAmount',
  CONTRACT_PAYMENT_PER_USER: 'contractPaymentPerUser',
  TIMES_USED_VERIFIED: 'timesUsedVerified',
  TOTAL_AMOUNT_COLLECTED: 'totalAmountCollected',
  TOTAL_CONTRACT_PAYOUT: 'totalContractPayout',
  VERIFIED_USERS: 'verifiedUsers',
  UPDATED_AT: 'updatedAt',
}
