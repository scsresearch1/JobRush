/**
 * Same as create-super-admin.js but skips TLS certificate verification.
 * Use only on trusted networks when corporate SSL inspection blocks Node.js.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
await import('./create-super-admin.js')
