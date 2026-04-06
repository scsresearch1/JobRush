/**
 * Default UPI QR shown in the payment modal when Firebase has no `adminPortal/paymentQr`
 * and `VITE_PAYMENT_QR_URL` is unset.
 *
 * Asset file (commit in repo): `jobrush_client/public/payment-phonepe-qr.png`
 * → served at site root as `/payment-phonepe-qr.png`.
 */
export const DEFAULT_PAYMENT_QR_PUBLIC_PATH = '/payment-phonepe-qr.png'

export function resolvePaymentQrFallbackSrc() {
  const configured = import.meta.env.VITE_PAYMENT_QR_URL
  if (configured) return configured
  return DEFAULT_PAYMENT_QR_PUBLIC_PATH
}
