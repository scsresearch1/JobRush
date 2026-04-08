# JobRush.ai Deployment (Netlify + Render)

## Architecture

- **Netlify**: Frontend (React/Vite static build)
- **Render**: Backend API (Node.js/Express)

All sensitive processing stays **local** (browser):
- Resume parsing (PDF/DOCX)
- Webcam capture & frame analysis (face-api.js)
- No raw video uploaded to the server

The server only receives structured data (resume JSON, behavioral report metrics) for AI calls.

---

## Netlify

1. Connect repo → New site from Git
2. Build settings (from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **Environment variables** (Build-time):
   - `VITE_FIREBASE_*` = your Firebase web config
   - **API base URL** is **not** an env var: production calls `https://jobrush.onrender.com` from `jobrush_client/src/config/jobrushApi.js`. Change that file if your Render service URL changes.

### If the app says it cannot reach the API

- Confirm **Render** is running (dashboard → your web service → logs). Free tier cold starts need a long first wait or a keep-warm ping.
- In the browser devtools **Network** tab, requests should go to `https://jobrush.onrender.com/api/...`.
- After changing `jobrushApi.js`, trigger a new Netlify build.

---

## Render

1. New → Web Service
2. Connect repo (or use `render.yaml` blueprint)
3. **Build command**: `npm install && cd server && npm install`
4. **Start command**: `node server/index.js`
5. **Environment variables**:
   - `GROQ_API_KEY` = your AI API key
   - Optional: `GOOGLE_APPLICATION_CREDENTIALS` for Indian TTS
   - The service listens on **`0.0.0.0:$PORT`** (Render sets `PORT`). Health check path: **`/api/health`** (fast, no outbound calls).
   - On Render, `RENDER=true` enables a **self-ping** every ~12 minutes to `/api/health` (disable with `ENABLE_SELF_PING=0`).

---

## Order

1. Deploy **Render** first
2. Deploy **Netlify** (ensure `jobrushApi.js` matches your Render URL if it is not the default)

---

## Keep-Warm (Render Free Tier)

Render free instances spin down after ~15 min of inactivity. First request can take 50+ seconds. Two mitigations:

### 1. GitHub Actions (built-in)

The repo includes `.github/workflows/keep-warm.yml` which pings `/api/health` every 10 minutes.

- **Enable**: Push the workflow; it runs automatically on schedule
- **Override URL**: Repo → Settings → Secrets and variables → Actions → add variable `RENDER_API_URL` = your Render URL

### 2. Client-side pre-warm

When users enter the app (Layout), a background ping to `/api/health` runs. This starts waking the server before they need AI features.

### 3. External cron (alternative)

Use [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com):

- URL: `https://your-render-app.onrender.com/api/health`
- Interval: every 10–15 minutes
