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

If login fails with a **permission** message, merge something like this into your Realtime Database rules (adjust the rest of your tree as needed):

```json
{
  "rules": {
    "adminPortal": {
      "credentials": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

You still need rules for `userdb`, `interviewReports`, etc.; the above only shows the admin slice.

## Troubleshooting “Could not load admin credentials”

1. **Netlify:** Under *Site settings → Environment variables*, set the same `VITE_FIREBASE_*` values as for the main JobRush build (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, etc.). The admin app is built by the same `npm run build`; without these, the admin bundle has no API key.
2. **Redeploy** after changing env vars (Vite bakes them in at build time).
3. **Rules:** Ensure `adminPortal/credentials` is readable (see above).
4. **Data:** Run `npm run firebase:create-collections` once so `adminPortal/credentials` exists.

## From repo root

```bash
npm run admin:dev
```

(requires `package.json` script in parent — see parent `package.json`)
