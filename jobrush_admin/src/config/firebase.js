import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { REALTIME_DATABASE_URL } from './realtimeDatabaseUrl.js'

/** API key from env; database URL from realtimeDatabaseUrl.js (same project as keys). */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jobbrush-f2eb4.firebaseapp.com',
  databaseURL: REALTIME_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jobbrush-f2eb4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

/** False when the admin bundle was built without a real web API key or Realtime Database URL. */
export function isFirebaseWebConfigReady() {
  const k = firebaseConfig.apiKey
  const u = firebaseConfig.databaseURL
  return Boolean(
    k && k !== 'your-api-key' && typeof u === 'string' && u.startsWith('https://') && u.includes('firebasedatabase')
  )
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
export default app
