import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'
import { COLLECTIONS, ADMIN_PORTAL_KEYS, PAYMENT_QR_FIELDS } from '../config/databaseSchema'

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
