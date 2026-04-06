/**
 * JobRush - Firebase Realtime Database Structure Setup Script
 *
 * *** CONVENTION: This script is the SINGLE SOURCE OF TRUTH for database structure. ***
 * When adding new collections, fields, or parameters - ALWAYS add them here first,
 * then run this script, then update src/config/databaseSchema.js to match.
 *
 * Run: npm run firebase:create-collections
 *
 * Prerequisites:
 *   npm install firebase-admin
 *
 * Usage:
 *   Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path,
 *   or place *-firebase-adminsdk-*.json in project root.
 *
 * Optional — push outbound SMTP to adminPortal/emailOutbound (same shape as admin Settings):
 *   Do NOT commit secrets. Set vars only in your shell for one run, then unset.
 *
 *   PowerShell:
 *     $env:JOBRUSH_EMAIL_OUTBOUND_SMTP_PASS="xxxx xxxx xxxx xxxx"   # Gmail app password
 *     $env:JOBRUSH_EMAIL_OUTBOUND_MAIL_FROM="you@gmail.com"
 *     $env:JOBRUSH_EMAIL_OUTBOUND_SMTP_USER="you@gmail.com"
 *     npm run firebase:create-collections
 *
 *   bash:
 *     export JOBRUSH_EMAIL_OUTBOUND_SMTP_PASS='...'
 *     export JOBRUSH_EMAIL_OUTBOUND_MAIL_FROM='you@gmail.com'
 *     export JOBRUSH_EMAIL_OUTBOUND_SMTP_USER='you@gmail.com'
 *     npm run firebase:create-collections
 *
 *   Optional: JOBRUSH_EMAIL_OUTBOUND_SMTP_HOST (default smtp.gmail.com), _SMTP_PORT (587),
 *   _SMTP_SECURE (true|false).
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Realtime Database URL (asia-southeast1 region)
const DATABASE_URL = 'https://jobrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app'

// =============================================================================
// COLLECTION STRUCTURE - Add new collections/fields HERE first, then run script
// After running: update src/config/databaseSchema.js to match
// =============================================================================

const COLLECTION_STRUCTURE = {
  userdb: {
    description:
      'User collection — UniqueID, EmailID, Timestamp; optional accessStatus, lastSeenAt, payment fields (synced from client)',
    fields: [
      'UniqueID',
      'EmailID',
      'Timestamp',
      'accessStatus',
      'lastSeenAt',
      'paymentReference',
      'accessRequestedAt',
      'couponCodePending',
      'suspended',
      'atsChecksUsed',
      'mockInterviewsUsed',
    ],
    seedDocuments: [], // Empty - node created with schema only
  },
  interviewReports: {
    description: 'Mock interview behavioral reports - userId, report, recommendations, generatedAt',
    fields: ['userId', 'report', 'recommendations', 'generatedAt'],
    seedDocuments: [], // Reports pushed by client via push()
  },
  atsReports: {
    description: 'ATS compatibility snapshots - userId, report (summary + scores), generatedAt',
    fields: ['userId', 'report', 'generatedAt'],
    seedDocuments: [],
  },
  adminPortal: {
    description:
      'JobRush admin portal (jadm): credentials, paymentQr, emailOutbound (SMTP for API mail). Lock down RTDB rules appropriately.',
    fields: ['username', 'password', 'mailFrom', 'smtpHost', 'smtpPort', 'smtpUser'],
    seedDocuments: [
      { id: 'credentials', data: { username: 'sd.niladri@gmail.com', password: 'JBRush@2026' } },
    ],
  },
}

// =============================================================================
// SCRIPT - Do not modify unless needed
// =============================================================================

function getServiceAccount() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (envPath && existsSync(envPath)) {
    return envPath
  }

  const projectRoot = join(__dirname, '..')
  const files = readdirSync(projectRoot).filter((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'))
  if (files.length > 0) {
    return join(projectRoot, files[0])
  }

  throw new Error(
    'Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or place service account JSON in project root.'
  )
}

/**
 * Writes adminPortal/emailOutbound when JOBRUSH_EMAIL_OUTBOUND_SMTP_PASS is set in the environment.
 * Never hardcode passwords in this file.
 */
async function seedEmailOutboundFromEnv(db) {
  const rawPass = process.env.JOBRUSH_EMAIL_OUTBOUND_SMTP_PASS
  const pass = rawPass != null ? String(rawPass).replace(/\s+/g, '').trim() : ''
  if (!pass) {
    console.log(
      '\nSkipping adminPortal/emailOutbound — set JOBRUSH_EMAIL_OUTBOUND_SMTP_PASS for one run to seed SMTP (or use admin Settings → Outbound email).'
    )
    return
  }

  const user =
    process.env.JOBRUSH_EMAIL_OUTBOUND_SMTP_USER ||
    process.env.JOBRUSH_EMAIL_OUTBOUND_MAIL_FROM ||
    ''
  const mailFrom = process.env.JOBRUSH_EMAIL_OUTBOUND_MAIL_FROM || user
  if (!mailFrom || !user) {
    console.warn(
      'JOBRUSH_EMAIL_OUTBOUND_SMTP_PASS is set but MAIL_FROM / SMTP_USER missing. Set JOBRUSH_EMAIL_OUTBOUND_MAIL_FROM and JOBRUSH_EMAIL_OUTBOUND_SMTP_USER.'
    )
    return
  }

  const host = process.env.JOBRUSH_EMAIL_OUTBOUND_SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.JOBRUSH_EMAIL_OUTBOUND_SMTP_PORT || 587)
  const secure = String(process.env.JOBRUSH_EMAIL_OUTBOUND_SMTP_SECURE || '').toLowerCase() === 'true'

  const ref = db.ref('adminPortal/emailOutbound')
  await ref.set({
    mailFrom,
    smtpHost: host,
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: user,
    smtpPass: pass,
    updatedAt: new Date().toISOString(),
    _createdAt: new Date().toISOString(),
    _createdBy: 'create-firebase-collections.js (env seed)',
  })
  console.log('\n  Wrote adminPortal/emailOutbound from environment (revoke/rotate that app password if it was ever exposed).')
}

async function createCollections() {
  const credPath = getServiceAccount()
  const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'))

  console.log(`\nDatabase URL: ${DATABASE_URL}`)
  console.log('(Must match the URL in your Firebase Console)\n')

  const app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: DATABASE_URL,
  })

  const db = getDatabase(app)

  const collections = Object.entries(COLLECTION_STRUCTURE)

  if (collections.length === 0) {
    console.log('No collections defined in COLLECTION_STRUCTURE.')
    console.log('Add your collection structure and run again.')
    process.exit(0)
  }

  for (const [name, config] of collections) {
    console.log(`\nNode: ${name}`)
    console.log(`  Description: ${config.description || 'N/A'}`)

    const nodeRef = db.ref(name)

    if (config.seedDocuments && config.seedDocuments.length > 0) {
      for (const doc of config.seedDocuments) {
        const docRef = doc.id ? db.ref(`${name}/${doc.id}`) : db.ref(`${name}`).push()
        await docRef.set({
          ...doc.data,
          _createdAt: new Date().toISOString(),
          _createdBy: 'create-firebase-collections.js',
        })
        console.log(`  Created document: ${docRef.key}`)
      }
    } else {
      // Set _schema only (don't overwrite existing user data)
      const schemaRef = db.ref(`${name}/_schema`)
      await schemaRef.set({
        fields: config.fields || ['UniqueID', 'EmailID', 'Timestamp'],
        description: config.description || '',
      })
      console.log(`  Schema initialized at ${name}/_schema`)
    }
  }

  await seedEmailOutboundFromEnv(db)

  console.log('\nDone. Refresh your Firebase Console to see the data.')
}

createCollections().catch((err) => {
  console.error(err)
  process.exit(1)
})
