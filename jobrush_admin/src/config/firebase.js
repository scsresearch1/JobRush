import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import {
  JOBBRUSH_AUTH_DOMAIN,
  JOBBRUSH_PROJECT_ID,
  JOBBRUSH_REALTIME_DATABASE_URL,
  JOBBRUSH_STORAGE_BUCKET_DEFAULT,
} from './firebaseJobbrushDefaults.js'

/** API key from env; project/RTDB locked — see firebaseJobbrushDefaults.js */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: JOBBRUSH_AUTH_DOMAIN,
  databaseURL: JOBBRUSH_REALTIME_DATABASE_URL,
  projectId: JOBBRUSH_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || JOBBRUSH_STORAGE_BUCKET_DEFAULT,
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
