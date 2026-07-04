/**
 * Creates or updates the JobRush super admin account in Firebase Realtime Database.
 *
 * Run: npm run firebase:create-super-admin
 *
 * Uses the RTDB REST API (no service account / firebase-admin required).
 * Requires network access to *.firebasedatabase.app.
 */

import { randomUUID } from 'crypto'

const DATABASE_URL = 'https://jobrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app'

const SUPER_ADMIN_EMAIL = 'sup_adm@jbrush.ai'
const SUPER_ADMIN_PASSWORD = 'ADMIN_JB'

async function rtdbGet(path) {
  const url = `${DATABASE_URL}/${path}.json`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

async function rtdbSet(path, data) {
  const url = `${DATABASE_URL}/${path}.json`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error(`PUT ${path} failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

async function rtdbPatch(path, data) {
  const url = `${DATABASE_URL}/${path}.json`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error(`PATCH ${path} failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

function findUserByEmail(users, email) {
  if (!users || typeof users !== 'object') return null
  const needle = email.trim().toLowerCase()
  for (const [id, data] of Object.entries(users)) {
    if (id === '_schema' || !data) continue
    const stored = String(data.EmailID || '').trim().toLowerCase()
    if (stored === needle) return { uniqueId: id, data }
  }
  return null
}

async function createSuperAdmin() {
  console.log(`Connecting to ${DATABASE_URL} ...`)

  const users = await rtdbGet('userdb')
  const existing = findUserByEmail(users, SUPER_ADMIN_EMAIL)
  const uniqueId = existing?.uniqueId || randomUUID()
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  const payload = {
    UniqueID: uniqueId,
    EmailID: SUPER_ADMIN_EMAIL,
    Timestamp: existing?.data?.Timestamp || timestamp,
    accessStatus: 'active',
    isSuperAdmin: true,
    password: SUPER_ADMIN_PASSWORD,
    atsChecksUsed: existing?.data?.atsChecksUsed ?? 0,
    mockInterviewsUsed: existing?.data?.mockInterviewsUsed ?? 0,
    suspended: false,
    lastSeenAt: new Date().toISOString(),
    _updatedAt: new Date().toISOString(),
    _updatedBy: 'create-super-admin.js',
  }

  await rtdbSet(`userdb/${uniqueId}`, payload)

  const schema = await rtdbGet('userdb/_schema')
  if (schema && typeof schema === 'object') {
    const fields = new Set([...(schema.fields || []), 'isSuperAdmin', 'password'])
    await rtdbPatch('userdb/_schema', { fields: [...fields] })
  }

  console.log('\nSuper admin account ready.')
  console.log(`  Email:    ${SUPER_ADMIN_EMAIL}`)
  console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`)
  console.log(`  User ID:  ${uniqueId}`)
  console.log('\nSign in via Start Your Journey → enter email → enter password.')
}

createSuperAdmin().catch((err) => {
  console.error('\nFailed to create super admin account.')
  console.error(err.message || err)
  if (err.cause) console.error('Cause:', err.cause.message || err.cause)
  const msg = `${err.message || err} ${err.cause?.message || ''}`
  if (msg.includes('certificate') || msg.includes('UNABLE_TO_VERIFY')) {
    console.error(
      '\nSSL certificate error — common on corporate networks / antivirus HTTPS scanning.',
    )
    console.error('Try one of:')
    console.error('  npm run firebase:create-super-admin:insecure')
    console.error('  node --use-system-ca scripts/create-super-admin.js')
    console.error('Or create the user manually in Firebase Console → Realtime Database → userdb.')
  }
  process.exit(1)
})
