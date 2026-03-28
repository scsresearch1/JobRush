/** Mirror of main app databaseSchema — keep in sync */
export const COLLECTIONS = {
  USERDB: 'userdb',
  INTERVIEW_REPORTS: 'interviewReports',
  ADMIN_PORTAL: 'adminPortal',
}

export const ADMIN_PORTAL_KEYS = {
  CREDENTIALS: 'credentials',
}

export const ADMIN_PORTAL_FIELDS = {
  USERNAME: 'username',
  PASSWORD: 'password',
}

export const USERDB_FIELDS = {
  UNIQUE_ID: 'UniqueID',
  EMAIL_ID: 'EmailID',
  TIMESTAMP: 'Timestamp',
}

export const INTERVIEW_REPORTS_FIELDS = {
  USER_ID: 'userId',
  REPORT: 'report',
  RECOMMENDATIONS: 'recommendations',
  GENERATED_AT: 'generatedAt',
}
