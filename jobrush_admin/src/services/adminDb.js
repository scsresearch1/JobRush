import { ref, get, set, update, remove, onValue, push } from 'firebase/database'
import { database } from '../config/firebase'
import {
  COLLECTIONS,
  ADMIN_PORTAL_KEYS,
  ADMIN_PORTAL_FIELDS,
  CONTRACT_ACCOUNT_FIELDS,
  USERDB_FIELDS,
  INTERVIEW_REPORTS_FIELDS,
  ATS_REPORT_FIELDS,
  COUPON_FIELDS,
  COUPON_REDEMPTION_FIELDS,
} from '../config/schema'

const MAX_QR_DATA_URL_CHARS = 450_000
const PLAN_AMOUNT_INR = 250

/** Users counted as online if lastSeenAt is within this window */
export const ONLINE_PRESENCE_WINDOW_MS = 3 * 60 * 1000

/**
 * @returns {{ registered: number, paymentPendingReview: number, onlineNow: number, legacyUnknown: number }}
 */
export function computeUserDashboardMetrics(val) {
  const entries = Object.entries(val || {}).filter(([k]) => k !== '_schema')
  const now = Date.now()
  let registered = 0
  let paymentPendingReview = 0
  let onlineNow = 0
  let legacyUnknown = 0

  for (const [, data] of entries) {
    if (!data || typeof data !== 'object') continue
    const email = String(data[USERDB_FIELDS.EMAIL_ID] || '').trim()
    const accessStatus = String(data[USERDB_FIELDS.ACCESS_STATUS] || '').trim()
    const isRealUser = Boolean(email) && Boolean(accessStatus)
    if (!isRealUser) {
      legacyUnknown += 1
      continue
    }
    registered += 1
    if (data[USERDB_FIELDS.ACCESS_STATUS] === 'awaiting_activation') paymentPendingReview += 1
    const seen = data[USERDB_FIELDS.LAST_SEEN_AT]
    if (typeof seen === 'string') {
      const t = Date.parse(seen)
      if (!Number.isNaN(t) && now - t < ONLINE_PRESENCE_WINDOW_MS) onlineNow += 1
    }
  }

  return { registered, paymentPendingReview, onlineNow, legacyUnknown }
}

function computeReportCount(val) {
  if (!val || typeof val !== 'object') return 0
  return Object.keys(val).filter((k) => k !== '_schema').length
}

/**
 * Live user metrics from userdb.
 * @param {(m: { registered: number, paymentPendingReview: number, onlineNow: number, legacyUnknown: number }) => void} onUpdate
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

export function couponsRef() {
  return ref(database, COLLECTIONS.COUPONS)
}

export function couponRef(couponCode) {
  return ref(database, `${COLLECTIONS.COUPONS}/${couponCode}`)
}

export function couponRedemptionsRef() {
  return ref(database, COLLECTIONS.COUPON_REDEMPTIONS)
}

export function couponRedemptionRef(couponCode) {
  return ref(database, `${COLLECTIONS.COUPON_REDEMPTIONS}/${couponCode}`)
}

function normalizeCouponCode(code) {
  return String(code || '').trim().toUpperCase()
}

function assertValidCouponCode(code) {
  if (!code) throw new Error('Coupon name is required.')
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw new Error('Coupon name must be 3-32 characters and use only letters, numbers, "_" or "-".')
  }
}

export function adminCredentialsRef() {
  return ref(database, `${COLLECTIONS.ADMIN_PORTAL}/${ADMIN_PORTAL_KEYS.CREDENTIALS}`)
}

export function contractAccountsRef() {
  return ref(database, `${COLLECTIONS.ADMIN_PORTAL}/${ADMIN_PORTAL_KEYS.CONTRACT_ACCOUNTS}`)
}

function contractAccountRef(accountId) {
  return ref(database, `${COLLECTIONS.ADMIN_PORTAL}/${ADMIN_PORTAL_KEYS.CONTRACT_ACCOUNTS}/${accountId}`)
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeContractCouponCodes(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((c) => normalizeCouponCode(c)).filter(Boolean)
  }
  if (typeof raw === 'object') {
    return Object.values(raw)
      .map((c) => normalizeCouponCode(c))
      .filter(Boolean)
  }
  return []
}

function assertValidContractUsername(u) {
  const s = String(u || '').trim()
  if (s.length < 2) throw new Error('Username must be at least 2 characters.')
  if (s.length > 64) throw new Error('Username cannot exceed 64 characters.')
  if (!/^[a-zA-Z0-9@._-]+$/.test(s)) {
    throw new Error('Username may only contain letters, numbers, and @ . _ -')
  }
}

/**
 * @returns {Promise<Array<{ id: string, username: string, displayName: string, couponCodes: string[], createdAt?: string, updatedAt?: string }>>}
 */
export async function listContractAccounts() {
  const snapshot = await get(contractAccountsRef())
  if (!snapshot.exists()) return []
  const val = snapshot.val()
  return Object.entries(val)
    .filter(([k]) => k !== '_schema')
    .map(([id, data]) => ({
      id,
      username: String(data?.[CONTRACT_ACCOUNT_FIELDS.USERNAME] || ''),
      displayName: String(data?.[CONTRACT_ACCOUNT_FIELDS.DISPLAY_NAME] || data?.[CONTRACT_ACCOUNT_FIELDS.USERNAME] || ''),
      couponCodes: normalizeContractCouponCodes(data?.[CONTRACT_ACCOUNT_FIELDS.COUPON_CODES]),
      createdAt: data?.[CONTRACT_ACCOUNT_FIELDS.CREATED_AT],
      updatedAt: data?.[CONTRACT_ACCOUNT_FIELDS.UPDATED_AT],
    }))
    .filter((r) => r.username)
    .sort((a, b) => a.username.localeCompare(b.username))
}

/**
 * @returns {Promise<{ id: string, username: string, displayName: string, couponCodes: string[] } | null>}
 */
export async function findContractAccountByCredentials(username, password) {
  const u = String(username || '').trim()
  const p = String(password || '')
  if (!u || !p) return null
  const rows = await listContractAccounts()
  const lower = u.toLowerCase()
  const row = rows.find((r) => r.username.toLowerCase() === lower)
  if (!row) return null
  const snap = await get(contractAccountRef(row.id))
  if (!snap.exists()) return null
  const stored = snap.val()?.[CONTRACT_ACCOUNT_FIELDS.PASSWORD]
  if (typeof stored !== 'string' || stored !== p) return null
  return { id: row.id, username: row.username, displayName: row.displayName, couponCodes: row.couponCodes }
}

/**
 * @param {{ username: string, password: string, displayName?: string, couponCodes: string[] }} params
 */
export async function createContractAccount({ username, password, displayName, couponCodes }) {
  assertValidContractUsername(username)
  const p = String(password || '')
  if (p.length < 8) throw new Error('Password must be at least 8 characters.')
  const codes = normalizeContractCouponCodes(couponCodes)
  if (codes.length === 0) throw new Error('Assign at least one coupon.')
  const u = String(username).trim()
  const existing = await listContractAccounts()
  if (existing.some((a) => a.username.toLowerCase() === u.toLowerCase())) {
    throw new Error('A contract account with this username already exists.')
  }
  const allCoupons = await listCoupons()
  const valid = new Set(allCoupons.map((c) => normalizeCouponCode(c[COUPON_FIELDS.COUPON_CODE])))
  for (const c of codes) {
    if (!valid.has(c)) {
      throw new Error(`Coupon ${c} is not defined. Create it under Coupon management first.`)
    }
  }
  const now = new Date().toISOString()
  const label = String(displayName || '').trim() || u
  const newRef = push(contractAccountsRef())
  await set(newRef, {
    [CONTRACT_ACCOUNT_FIELDS.USERNAME]: u,
    [CONTRACT_ACCOUNT_FIELDS.PASSWORD]: p,
    [CONTRACT_ACCOUNT_FIELDS.DISPLAY_NAME]: label,
    [CONTRACT_ACCOUNT_FIELDS.COUPON_CODES]: codes,
    [CONTRACT_ACCOUNT_FIELDS.CREATED_AT]: now,
    [CONTRACT_ACCOUNT_FIELDS.UPDATED_AT]: now,
  })
}

/**
 * @param {string} accountId
 * @param {{ password?: string, displayName?: string, couponCodes?: string[] }} patch
 */
export async function updateContractAccount(accountId, patch) {
  const id = String(accountId || '').trim()
  if (!id) throw new Error('Account id is required.')
  const snap = await get(contractAccountRef(id))
  if (!snap.exists()) throw new Error('Contract account not found.')
  const next = {}
  if (patch.password != null) {
    const p = String(patch.password)
    if (p.length < 8) throw new Error('Password must be at least 8 characters.')
    next[CONTRACT_ACCOUNT_FIELDS.PASSWORD] = p
  }
  if (patch.displayName != null) {
    next[CONTRACT_ACCOUNT_FIELDS.DISPLAY_NAME] = String(patch.displayName).trim() || snap.val()[CONTRACT_ACCOUNT_FIELDS.USERNAME]
  }
  if (patch.couponCodes != null) {
    const codes = normalizeContractCouponCodes(patch.couponCodes)
    if (codes.length === 0) throw new Error('Assign at least one coupon.')
    const allCoupons = await listCoupons()
    const valid = new Set(allCoupons.map((c) => normalizeCouponCode(c[COUPON_FIELDS.COUPON_CODE])))
    for (const c of codes) {
      if (!valid.has(c)) {
        throw new Error(`Coupon ${c} is not defined. Create it under Coupon management first.`)
      }
    }
    next[CONTRACT_ACCOUNT_FIELDS.COUPON_CODES] = codes
  }
  if (Object.keys(next).length === 0) return
  next[CONTRACT_ACCOUNT_FIELDS.UPDATED_AT] = new Date().toISOString()
  await update(contractAccountRef(id), next)
}

export async function deleteContractAccount(accountId) {
  const id = String(accountId || '').trim()
  if (!id) throw new Error('Account id is required.')
  await remove(contractAccountRef(id))
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

export async function listCoupons() {
  const snapshot = await get(couponsRef())
  if (!snapshot.exists()) return []
  const val = snapshot.val()
  return Object.entries(val)
    .filter(([k]) => k !== '_schema')
    .map(([id, data]) => ({ id, ...data }))
    .filter((r) => r?.[COUPON_FIELDS.COUPON_CODE])
}

export async function createCoupon({
  couponCode,
  contractName,
  discountAmount,
  contractPaymentPerUser,
  validityDays,
}) {
  const code = normalizeCouponCode(couponCode)
  assertValidCouponCode(code)
  const contract = String(contractName || '').trim()
  if (!contract) throw new Error('Contract name is required.')
  const discount = Number(discountAmount)
  if (!Number.isFinite(discount) || discount < 0) throw new Error('Discount amount must be 0 or more.')
  if (discount > PLAN_AMOUNT_INR) throw new Error(`Discount cannot exceed plan amount (₹${PLAN_AMOUNT_INR}).`)
  const payoutPerUser = Number(contractPaymentPerUser)
  if (!Number.isFinite(payoutPerUser) || payoutPerUser < 0) {
    throw new Error('Contract payment per user must be 0 or more.')
  }
  const days = Math.max(1, Math.floor(Number(validityDays) || 0))
  if (!days) throw new Error('Validity must be at least 1 day.')
  if (days > 3650) throw new Error('Validity cannot exceed 3650 days.')

  const now = new Date()
  const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
  const existing = await get(couponRef(code))
  if (existing.exists()) throw new Error(`Coupon ${code} already exists.`)

  await set(couponRef(code), {
    [COUPON_FIELDS.COUPON_CODE]: code,
    [COUPON_FIELDS.CONTRACT_NAME]: contract,
    [COUPON_FIELDS.DISCOUNT_AMOUNT]: discount,
    [COUPON_FIELDS.CONTRACT_PAYMENT_PER_USER]: payoutPerUser,
    [COUPON_FIELDS.VALIDITY_DAYS]: days,
    [COUPON_FIELDS.VALID_UNTIL]: validUntil,
    [COUPON_FIELDS.IS_ACTIVE]: true,
    [COUPON_FIELDS.CREATED_AT]: now.toISOString(),
    [COUPON_FIELDS.UPDATED_AT]: now.toISOString(),
  })
}

export async function setCouponActiveState(couponCode, isActive) {
  const code = normalizeCouponCode(couponCode)
  assertValidCouponCode(code)
  const snap = await get(couponRef(code))
  if (!snap.exists()) throw new Error(`Coupon ${code} not found.`)
  await update(couponRef(code), {
    [COUPON_FIELDS.IS_ACTIVE]: Boolean(isActive),
    [COUPON_FIELDS.UPDATED_AT]: new Date().toISOString(),
  })
}

export async function listCouponStatuses() {
  const [coupons, redemptionsSnap] = await Promise.all([listCoupons(), get(couponRedemptionsRef())])
  const redemptionRows = redemptionsSnap.exists() ? redemptionsSnap.val() : {}
  const byCode = Object.fromEntries(
    coupons.map((c) => [normalizeCouponCode(c[COUPON_FIELDS.COUPON_CODE]), c])
  )

  const merged = coupons.map((c) => {
    const code = normalizeCouponCode(c[COUPON_FIELDS.COUPON_CODE])
    const r = redemptionRows?.[code] || {}
    return {
      couponCode: code,
      contractName: c[COUPON_FIELDS.CONTRACT_NAME] || '—',
      timesUsedVerified: Number(r?.[COUPON_REDEMPTION_FIELDS.TIMES_USED_VERIFIED]) || 0,
      totalAmountCollected: Number(r?.[COUPON_REDEMPTION_FIELDS.TOTAL_AMOUNT_COLLECTED]) || 0,
      totalContractPayout: Number(r?.[COUPON_REDEMPTION_FIELDS.TOTAL_CONTRACT_PAYOUT]) || 0,
    }
  })

  for (const [k, v] of Object.entries(redemptionRows || {})) {
    if (k === '_schema' || byCode[k]) continue
    merged.push({
      couponCode: k,
      contractName: v?.[COUPON_REDEMPTION_FIELDS.CONTRACT_NAME] || '—',
      timesUsedVerified: Number(v?.[COUPON_REDEMPTION_FIELDS.TIMES_USED_VERIFIED]) || 0,
      totalAmountCollected: Number(v?.[COUPON_REDEMPTION_FIELDS.TOTAL_AMOUNT_COLLECTED]) || 0,
      totalContractPayout: Number(v?.[COUPON_REDEMPTION_FIELDS.TOTAL_CONTRACT_PAYOUT]) || 0,
    })
  }

  return merged.sort((a, b) => a.couponCode.localeCompare(b.couponCode))
}

/**
 * Records coupon usage only after admin verifies payment.
 */
export async function recordCouponRedemptionFromApproval(userRow) {
  const uid = String(userRow?.id || '').trim()
  if (!uid) return
  const rawCode = userRow?.[USERDB_FIELDS.COUPON_CODE_PENDING]
  const code = normalizeCouponCode(rawCode)
  if (!code) return

  const couponSnap = await get(couponRef(code))
  if (!couponSnap.exists()) return
  const coupon = couponSnap.val() || {}
  const discount = Math.max(0, Number(coupon?.[COUPON_FIELDS.DISCOUNT_AMOUNT]) || 0)
  const payoutPerUser = Math.max(0, Number(coupon?.[COUPON_FIELDS.CONTRACT_PAYMENT_PER_USER]) || 0)
  const amountCollected = Math.max(0, PLAN_AMOUNT_INR - discount)

  const statusSnap = await get(couponRedemptionRef(code))
  const prev = statusSnap.exists() ? statusSnap.val() : {}
  const verifiedUsers = { ...(prev?.[COUPON_REDEMPTION_FIELDS.VERIFIED_USERS] || {}) }
  if (verifiedUsers[uid] === true) return
  verifiedUsers[uid] = true

  const times = (Number(prev?.[COUPON_REDEMPTION_FIELDS.TIMES_USED_VERIFIED]) || 0) + 1
  const totalAmount =
    (Number(prev?.[COUPON_REDEMPTION_FIELDS.TOTAL_AMOUNT_COLLECTED]) || 0) + amountCollected
  const totalPayout =
    (Number(prev?.[COUPON_REDEMPTION_FIELDS.TOTAL_CONTRACT_PAYOUT]) || 0) + payoutPerUser

  await set(couponRedemptionRef(code), {
    [COUPON_REDEMPTION_FIELDS.COUPON_CODE]: code,
    [COUPON_REDEMPTION_FIELDS.CONTRACT_NAME]:
      coupon?.[COUPON_FIELDS.CONTRACT_NAME] || prev?.[COUPON_REDEMPTION_FIELDS.CONTRACT_NAME] || '—',
    [COUPON_REDEMPTION_FIELDS.DISCOUNT_AMOUNT]: discount,
    [COUPON_REDEMPTION_FIELDS.CONTRACT_PAYMENT_PER_USER]: payoutPerUser,
    [COUPON_REDEMPTION_FIELDS.TIMES_USED_VERIFIED]: times,
    [COUPON_REDEMPTION_FIELDS.TOTAL_AMOUNT_COLLECTED]: totalAmount,
    [COUPON_REDEMPTION_FIELDS.TOTAL_CONTRACT_PAYOUT]: totalPayout,
    [COUPON_REDEMPTION_FIELDS.VERIFIED_USERS]: verifiedUsers,
    [COUPON_REDEMPTION_FIELDS.UPDATED_AT]: new Date().toISOString(),
  })
}

/**
 * Clears verified usage counters and payout totals for a coupon code.
 * Keeps contract metadata so future approvals still work. Does not delete the coupon definition under `coupons/`.
 */
export async function resetCouponRedemptionStats(couponCode) {
  const code = normalizeCouponCode(couponCode)
  assertValidCouponCode(code)
  const [couponSnap, redSnap] = await Promise.all([get(couponRef(code)), get(couponRedemptionRef(code))])
  if (!couponSnap.exists() && !redSnap.exists()) {
    throw new Error(`Nothing to reset for ${code}.`)
  }
  if (!redSnap.exists()) {
    throw new Error(`No verified usage recorded for ${code} yet.`)
  }

  const coupon = couponSnap.exists() ? couponSnap.val() : {}
  const prev = redSnap.val() || {}
  const contractName =
    coupon?.[COUPON_FIELDS.CONTRACT_NAME] || prev?.[COUPON_REDEMPTION_FIELDS.CONTRACT_NAME] || '—'
  const discount = Math.max(
    0,
    Number(coupon?.[COUPON_FIELDS.DISCOUNT_AMOUNT] ?? prev?.[COUPON_REDEMPTION_FIELDS.DISCOUNT_AMOUNT] ?? 0) || 0
  )
  const payoutPerUser = Math.max(
    0,
    Number(
      coupon?.[COUPON_FIELDS.CONTRACT_PAYMENT_PER_USER] ??
        prev?.[COUPON_REDEMPTION_FIELDS.CONTRACT_PAYMENT_PER_USER] ??
        0
    ) || 0
  )

  await set(couponRedemptionRef(code), {
    [COUPON_REDEMPTION_FIELDS.COUPON_CODE]: code,
    [COUPON_REDEMPTION_FIELDS.CONTRACT_NAME]: contractName,
    [COUPON_REDEMPTION_FIELDS.DISCOUNT_AMOUNT]: discount,
    [COUPON_REDEMPTION_FIELDS.CONTRACT_PAYMENT_PER_USER]: payoutPerUser,
    [COUPON_REDEMPTION_FIELDS.TIMES_USED_VERIFIED]: 0,
    [COUPON_REDEMPTION_FIELDS.TOTAL_AMOUNT_COLLECTED]: 0,
    [COUPON_REDEMPTION_FIELDS.TOTAL_CONTRACT_PAYOUT]: 0,
    [COUPON_REDEMPTION_FIELDS.VERIFIED_USERS]: {},
    [COUPON_REDEMPTION_FIELDS.UPDATED_AT]: new Date().toISOString(),
  })
}

/**
 * Removes the coupon contract (`coupons/{code}`) and redemption ledger (`couponRedemptions/{code}`) if present.
 */
export async function deleteCouponAndRedemptions(couponCode) {
  const code = normalizeCouponCode(couponCode)
  assertValidCouponCode(code)
  const [couponSnap, redSnap] = await Promise.all([get(couponRef(code)), get(couponRedemptionRef(code))])
  if (!couponSnap.exists() && !redSnap.exists()) {
    throw new Error(`Coupon ${code} not found.`)
  }
  const tasks = []
  if (couponSnap.exists()) tasks.push(remove(couponRef(code)))
  if (redSnap.exists()) tasks.push(remove(couponRedemptionRef(code)))
  await Promise.all(tasks)
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
