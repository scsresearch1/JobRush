/**
 * Firebase web app **jobbrush-f2eb4** — keep in sync with Realtime Database + API key from the same project.
 * These are not read from env so a wrong VITE_FIREBASE_PROJECT_ID on Netlify cannot break RTDB.
 *
 * If you create a new Firebase project, update this file + jobrush_admin copy + server DEFAULT_FIREBASE_RTDB_URL.
 */
export const JOBBRUSH_PROJECT_ID = 'jobbrush-f2eb4'
export const JOBBRUSH_AUTH_DOMAIN = 'jobbrush-f2eb4.firebaseapp.com'
export const JOBBRUSH_REALTIME_DATABASE_URL =
  'https://jobbrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app'
/** Default bucket pattern; override via VITE_FIREBASE_STORAGE_BUCKET if Console shows a different value. */
export const JOBBRUSH_STORAGE_BUCKET_DEFAULT = 'jobbrush-f2eb4.firebasestorage.app'
