import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'
import { COLLECTIONS, ADMIN_PORTAL_KEYS, PAYMENT_QR_FIELDS, COUPON_FIELDS } from '../config/databaseSchema'

const paymentQrUrlRef = ref(
  database,
  `${COLLECTIONS.ADMIN_PORTAL}/${ADMIN_PORTAL_KEYS.PAYMENT_QR}/${PAYMENT_QR_FIELDS.QR_IMAGE_URL}`
)

/**
 * @returns {Promise<string | null>}
 */
export async function fetchPaymentQrImageUrlFromFirebase() {
  const snap = await get(paymentQrUrlRef)
  if (!snap.exists()) return null
  const v = snap.val()
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function fetchCouponFromFirebase(couponCode) {
  const code = String(couponCode || '').trim().toUpperCase()
  if (!code) return { ok: false, reason: 'empty' }
  const snap = await get(ref(database, `${COLLECTIONS.COUPONS}/${code}`))
  if (!snap.exists()) return { ok: false, reason: 'not_found' }
  const row = snap.val() || {}
  const isActive = row?.[COUPON_FIELDS.IS_ACTIVE] !== false
  if (!isActive) return { ok: false, reason: 'inactive' }
  const validUntil = String(row?.[COUPON_FIELDS.VALID_UNTIL] || '')
  if (validUntil) {
    const untilMs = Date.parse(validUntil)
    if (!Number.isNaN(untilMs) && untilMs < Date.now()) return { ok: false, reason: 'expired' }
  }
  return {
    ok: true,
    coupon: {
      couponCode: code,
      discountAmount: Math.max(0, Number(row?.[COUPON_FIELDS.DISCOUNT_AMOUNT]) || 0),
      contractName: String(row?.[COUPON_FIELDS.CONTRACT_NAME] || '').trim(),
    },
  }
}
