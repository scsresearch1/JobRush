import { ref, get, set, remove } from 'firebase/database'
import { database } from '../config/firebase'
import {
  COLLECTIONS,
  ADMIN_PORTAL_KEYS,
  ADMIN_PORTAL_FIELDS,
  USERDB_FIELDS,
  INTERVIEW_REPORTS_FIELDS,
} from '../config/schema'

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

export function adminCredentialsRef() {
  return ref(database, `${COLLECTIONS.ADMIN_PORTAL}/${ADMIN_PORTAL_KEYS.CREDENTIALS}`)
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
    [ADMIN_PORTAL_FIELDS.USERNAME]: next.username ?? prev[ADMIN_PORTAL_FIELDS.USERNAME] ?? 'jadm',
    [ADMIN_PORTAL_FIELDS.PASSWORD]: next.password,
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
  return Object.entries(val).map(([id, data]) => ({
    id,
    [INTERVIEW_REPORTS_FIELDS.USER_ID]: data?.[INTERVIEW_REPORTS_FIELDS.USER_ID],
    [INTERVIEW_REPORTS_FIELDS.GENERATED_AT]: data?.[INTERVIEW_REPORTS_FIELDS.GENERATED_AT],
    [INTERVIEW_REPORTS_FIELDS.REPORT]: data?.[INTERVIEW_REPORTS_FIELDS.REPORT],
    [INTERVIEW_REPORTS_FIELDS.RECOMMENDATIONS]: data?.[INTERVIEW_REPORTS_FIELDS.RECOMMENDATIONS],
  }))
}

export async function deleteUser(uniqueId) {
  await remove(userRef(uniqueId))
}

export async function deleteInterviewReport(reportId) {
  await remove(interviewReportRef(reportId))
}
