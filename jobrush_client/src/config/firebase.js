/**
 * JobRush.ai - Firebase Configuration
 *
 * Central config for Firebase Realtime Database access across the app.
 * Add your Firebase web config from: Firebase Console → Project Settings → General → Your apps
 */

import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import {
  JOBBRUSH_AUTH_DOMAIN,
  JOBBRUSH_PROJECT_ID,
  JOBBRUSH_REALTIME_DATABASE_URL,
  JOBBRUSH_STORAGE_BUCKET_DEFAULT,
} from './firebaseJobbrushDefaults.js'

// projectId / authDomain / databaseURL locked to jobbrush-f2eb4 (env cannot mismatch Netlify typos)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'your-api-key',
  authDomain: JOBBRUSH_AUTH_DOMAIN,
  databaseURL: JOBBRUSH_REALTIME_DATABASE_URL,
  projectId: JOBBRUSH_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || JOBBRUSH_STORAGE_BUCKET_DEFAULT,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

const app = initializeApp(firebaseConfig)
/** Pass URL explicitly — avoids some regional RTDB / config mismatch warnings in the SDK. */
export const database = getDatabase(app, JOBBRUSH_REALTIME_DATABASE_URL)

export default app
