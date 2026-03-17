/**
 * JobRush.ai - Firebase Configuration
 *
 * Central config for Firebase Realtime Database access across the app.
 * Add your Firebase web config from: Firebase Console → Project Settings → General → Your apps
 */

import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

// Firebase Web Config - use env vars or replace with your values from Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'your-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jobrush-f2eb4.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://jobrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jobrush-f2eb4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jobrush-f2eb4.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)

export default app
