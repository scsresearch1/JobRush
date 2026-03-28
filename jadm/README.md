# JobRush Admin Portal (`jadm`)

Standalone React + Vite app for managing **Firebase Realtime Database** data used by JobRush.ai.

## Features

- **Dashboard** — counts for `userdb` and `interviewReports`
- **Users** — list, search, delete (`userdb`)
- **Interview reports** — list, expand preview, delete (`interviewReports`)
- **Login** — username and password read from Firebase at `adminPortal/credentials` (seeded by the repo script). Session in `sessionStorage` (8h).
- **Settings** — change admin password (writes back to `adminPortal/credentials`).

## Setup

```bash
cd jadm
npm install
cp .env.example .env.local
# Fill VITE_FIREBASE_* from Firebase Console (same as main app)
npm run dev
```

From the **repository root**, seed the database (creates `adminPortal/credentials` with default username `jadm` and password `JBRush@2026` if you use the bundled seed):

```bash
npm run firebase:create-collections
```

Local dev: **http://localhost:5174/jadm/** (base path is `/jadm`).

Production (same Netlify site as JobRush): **https://jbrush.netlify.app/jadm/** — the root `npm run build` copies `jadm/dist` into `dist/jadm`; see repo `netlify.toml` redirects.

## Build & deploy

```bash
npm run build
npm run preview
```

Deploy `dist/` to any static host (separate Netlify site, S3, etc.). Set the Firebase web config env vars in the host dashboard.

## Firebase rules

The admin app uses the **client SDK**. RTDB rules must allow read on `adminPortal/credentials` for login and write for password changes — or the portal cannot work. **Plain passwords in RTDB are sensitive:** restrict rules (e.g. no public read/write), deploy the admin app only on a trusted network, or move to Firebase Auth later.

## From repo root

```bash
npm run admin:dev
```

(requires `package.json` script in parent — see parent `package.json`)
