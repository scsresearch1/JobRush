/**
 * JobRush API origin (Render Web Service). Hardcoded in production so deploys do not depend on VITE_API_URL.
 * Development: empty string → Vite proxies /api to http://localhost:3001 (see jobrush_client/vite.config.js).
 */
export const JOB_RUSH_API_ORIGIN = import.meta.env.PROD ? 'https://jobrush.onrender.com' : ''
