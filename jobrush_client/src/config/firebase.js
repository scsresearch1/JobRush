/**
 * JobRush.ai - Firebase Configuration
 *
 * Central config for Firebase Realtime Database access across the app.
 * Add your Firebase web config from: Firebase Console → Project Settings → General → Your apps
 */

import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { REALTIME_DATABASE_URL } from './realtimeDatabaseUrl.js'

// Firebase Web Config — API key etc. from env; DB URL is fixed in realtimeDatabaseUrl.js
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'your-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jobbrush-f2eb4.firebaseapp.com',
  databaseURL: REALTIME_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jobbrush-f2eb4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jobbrush-f2eb4.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)

export default app
