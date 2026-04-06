import { ref, get, set, update, remove, onValue } from 'firebase/database'
import { database } from '../config/firebase'
import {
  COLLECTIONS,
  ADMIN_PORTAL_KEYS,
  ADMIN_PORTAL_FIELDS,
  USERDB_FIELDS,
  INTERVIEW_REPORTS_FIELDS,
  ATS_REPORT_FIELDS,
} from '../config/schema'

const MAX_QR_DATA_URL_CHARS = 450_000

/** Users counted as online if lastSeenAt is within this window */
export const ONLINE_PRESENCE_WINDOW_MS = 3 * 60 * 1000

/**
 * @returns {{ registered: number, paymentPendingReview: number, onlineNow: number }}
 */
export function computeUserDashboardMetrics(val) {
  const entries = Object.entries(val || {}).filter(([k]) => k !== '_schema')
  const now = Date.now()
  let registered = 0
  let paymentPendingReview = 0
  let onlineNow = 0

  for (const [, data] of entries) {
    if (!data || typeof data !== 'object') continue
    registered += 1
    if (data[USERDB_FIELDS.ACCESS_STATUS] === 'awaiting_activation') paymentPendingReview += 1
    const seen = data[USERDB_FIELDS.LAST_SEEN_AT]
    if (typeof seen === 'string') {
      const t = Date.parse(seen)
      if (!Number.isNaN(t) && now - t < ONLINE_PRESENCE_WINDOW_MS) onlineNow += 1
    }
  }

  return { registered, paymentPendingReview, onlineNow }
}

function computeReportCount(val) {
  if (!val || typeof val !== 'object') return 0
  return Object.keys(val).filter((k) => k !== '_schema').length
}

/**
 * Live user metrics from userdb.
 * @param {(m: { registered: number, paymentPendingReview: number, onlineNow: number }) => void} onUpdate
 * @returns {() => void} unsubscribe
 */
export function subscribeUserDashboardMetrics(onUpdate) {
  return onValue(userdbRef(), (snapshot) => {
    const val = snapshot.exists() ? snapshot.val() : {}
    onUpdate(computeUserDashboardMetrics(val))
  })
}

/**
 * @param {(count: number) => void} onUpdate
 * @returns {() => void} unsubscribe
 */
export function subscribeInterviewReportCount(onUpdate) {
  return onValue(interviewReportsRef(), (snapshot) => {
    const val = snapshot.exists() ? snapshot.val() : {}
    onUpdate(computeReportCount(val))
  })
}

export function userdbRef() {
  return ref(database, COLLECTIONS.USERDB)
}

export function userRef(uniqueId) {
  return ref(database, `${COLLECTIONS.USERDB}/${uniqueId}`)
}

export function interviewReportsRef() {
  return ref(database, COLLECTIONS.INTERVIEW_REPORTS)
}

export function interviewReportRef(reportId) {
  return ref(database, `${COLLECTIONS.INTERVIEW_REPORTS}/${reportId}`)
}

export function atsReportsRef() {
  return ref(database, COLLECTIONS.ATS_REPORTS)
}

export function atsReportRef(reportId) {
  return ref(database, `${COLLECTIONS.ATS_REPORTS}/${reportId}`)
}

export function adminCredentialsRef() {
  return ref(database, `${COLLECTIONS.ADMIN_PORTAL}/${ADMIN_PORTAL_KEYS.CREDENTIALS}`)
}

export function paymentQrRef() {
  return ref(database, `${COLLECTIONS.ADMIN_PORTAL}/${ADMIN_PORTAL_KEYS.PAYMENT_QR}`)
}

/**
 * @returns {Promise<string | null>}
 */
export async function getPaymentQrImageUrl() {
  const snapshot = await get(paymentQrRef())
  if (!snapshot.exists()) return null
  const val = snapshot.val()?.[ADMIN_PORTAL_FIELDS.QR_IMAGE_URL]
  return typeof val === 'string' && val.length > 0 ? val : null
}

/**
 * @param {string} qrImageUrl — data URL or https URL
 */
export async function setPaymentQrImageUrl(qrImageUrl) {
  const s = String(qrImageUrl || '')
  if (s.length > MAX_QR_DATA_URL_CHARS) {
    throw new Error(`QR image is too large for the database (max ~${Math.floor(MAX_QR_DATA_URL_CHARS / 1000)}k characters). Use a smaller PNG or host the image and paste a URL.`)
  }
  await set(paymentQrRef(), {
    [ADMIN_PORTAL_FIELDS.QR_IMAGE_URL]: s,
    updatedAt: new Date().toISOString(),
  })
}

export async function clearPaymentQrImageUrl() {
  await remove(paymentQrRef())
}

/**
 * @returns {Promise<{ username: string, password: string } | null>}
 */
export async function getAdminCredentials() {
  const snapshot = await get(adminCredentialsRef())
  if (!snapshot.exists()) return null
  const val = snapshot.val()
  const username = val?.[ADMIN_PORTAL_FIELDS.USERNAME]
  const password = val?.[ADMIN_PORTAL_FIELDS.PASSWORD]
  if (typeof username !== 'string' || typeof password !== 'string') return null
  return { username, password }
}

/**
 * @param {{ username?: string, password: string }} next — merges with existing record
 */
export async function saveAdminCredentials(next) {
  const snapshot = await get(adminCredentialsRef())
  const prev = snapshot.exists() ? snapshot.val() : {}
  await set(adminCredentialsRef(), {
    ...prev,
    [ADMIN_PORTAL_FIELDS.USERNAME]: next.username ?? prev[ADMIN_PORTAL_FIELDS.USERNAME] ?? 'sd.niladri@gmail.com',
    [ADMIN_PORTAL_FIELDS.PASSWORD]: next.password,
  })
}

/**
 * @param {string} newUsername
 */
export async function saveAdminUsernameOnly(newUsername) {
  const snapshot = await get(adminCredentialsRef())
  const prev = snapshot.exists() ? snapshot.val() : {}
  await set(adminCredentialsRef(), {
    ...prev,
    [ADMIN_PORTAL_FIELDS.USERNAME]:
      String(newUsername || '').trim() || prev[ADMIN_PORTAL_FIELDS.USERNAME] || 'sd.niladri@gmail.com',
  })
}

/**
 * @returns {Promise<Array<{ id: string, UniqueID?: string, EmailID?: string, Timestamp?: string }>>}
 */
export async function listUsers() {
  const snapshot = await get(userdbRef())
  if (!snapshot.exists()) return []
  const val = snapshot.val()
  return Object.entries(val)
    .filter(([k]) => k !== '_schema')
    .map(([id, data]) => ({
      id,
      ...data,
    }))
    .filter((u) => u && (u[USERDB_FIELDS.EMAIL_ID] || u[USERDB_FIELDS.UNIQUE_ID] || u.id))
}

/**
 * @returns {Promise<Array<{ id: string, userId?: string, generatedAt?: string, report?: object, recommendations?: array }>>}
 */
export async function listInterviewReports() {
  const snapshot = await get(interviewReportsRef())
  if (!snapshot.exists()) return []
  const val = snapshot.val()
  return Object.entries(val)
    .filter(([k]) => k !== '_schema')
    .map(([id, data]) => ({
      id,
      [INTERVIEW_REPORTS_FIELDS.USER_ID]: data?.[INTERVIEW_REPORTS_FIELDS.USER_ID],
      [INTERVIEW_REPORTS_FIELDS.GENERATED_AT]: data?.[INTERVIEW_REPORTS_FIELDS.GENERATED_AT],
      [INTERVIEW_REPORTS_FIELDS.REPORT]: data?.[INTERVIEW_REPORTS_FIELDS.REPORT],
      [INTERVIEW_REPORTS_FIELDS.RECOMMENDATIONS]: data?.[INTERVIEW_REPORTS_FIELDS.RECOMMENDATIONS],
    }))
}

/**
 * @returns {Promise<Array<{ id: string, userId?: string, generatedAt?: string, report?: object }>>}
 */
export async function listAtsReports() {
  const snapshot = await get(atsReportsRef())
  if (!snapshot.exists()) return []
  const val = snapshot.val()
  return Object.entries(val)
    .filter(([k]) => k !== '_schema')
    .map(([id, data]) => ({
      id,
      [ATS_REPORT_FIELDS.USER_ID]: data?.[ATS_REPORT_FIELDS.USER_ID],
      [ATS_REPORT_FIELDS.GENERATED_AT]: data?.[ATS_REPORT_FIELDS.GENERATED_AT],
      [ATS_REPORT_FIELDS.REPORT]: data?.[ATS_REPORT_FIELDS.REPORT],
    }))
}

export async function deleteUser(uniqueId) {
  await remove(userRef(uniqueId))
}

/**
 * @param {Record<string, unknown>} patch — shallow merge into userdb/{uniqueId}
 */
export async function updateUserRecord(uniqueId, patch) {
  await update(userRef(uniqueId), patch)
}

export async function deleteInterviewReport(reportId) {
  await remove(interviewReportRef(reportId))
}

export async function deleteAtsReport(reportId) {
  await remove(atsReportRef(reportId))
}

/**
 * Removes all mock interview and ATS reports for a user and resets usage counters on their userdb node (if present).
 */
export async function deleteAllReportsForUser(userId) {
  const [interviews, atsRows] = await Promise.all([listInterviewReports(), listAtsReports()])
  const delInt = interviews
    .filter((r) => r[INTERVIEW_REPORTS_FIELDS.USER_ID] === userId)
    .map((r) => deleteInterviewReport(r.id))
  const delAts = atsRows.filter((r) => r[ATS_REPORT_FIELDS.USER_ID] === userId).map((r) => deleteAtsReport(r.id))
  await Promise.all([...delInt, ...delAts])
  const users = await listUsers()
  if (users.some((u) => u.id === userId)) {
    await updateUserRecord(userId, {
      [USERDB_FIELDS.ATS_CHECKS_USED]: 0,
      [USERDB_FIELDS.MOCK_INTERVIEWS_USED]: 0,
    })
  }
}
