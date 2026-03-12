# JobRush Deployment (Netlify + Render)

## Architecture

- **Netlify**: Frontend (React/Vite static build)
- **Render**: Backend API (Node.js/Express)

All sensitive processing stays **local** (browser):
- Resume parsing (PDF/DOCX)
- Webcam capture & frame analysis (face-api.js)
- No raw video uploaded to the server

The server only receives structured data (resume JSON, behavioral report metrics) for Groq AI calls.

---

## Netlify

1. Connect repo → New site from Git
2. Build settings (from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **Environment variables** (Build-time):
   - `VITE_API_URL` = `https://your-render-app.onrender.com` (no trailing slash)
   - `VITE_FIREBASE_*` = your Firebase web config

---

## Render

1. New → Web Service
2. Connect repo (or use `render.yaml` blueprint)
3. **Build command**: `npm install && cd server && npm install`
4. **Start command**: `node server/index.js`
5. **Environment variables**:
   - `GROQ_API_KEY` = your Groq API key
   - Optional: `GOOGLE_APPLICATION_CREDENTIALS` for Indian TTS

---

## Order

1. Deploy **Render** first → get the API URL
2. Deploy **Netlify** with `VITE_API_URL` set to that URL

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
