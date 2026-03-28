import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jobrush-f2eb4.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://jobrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jobrush-f2eb4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

/** False when the admin bundle was built without a real web API key (common on Netlify if env vars are missing). */
export function isFirebaseWebConfigReady() {
  const k = firebaseConfig.apiKey
  return Boolean(k && k !== 'your-api-key')
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
export default app
