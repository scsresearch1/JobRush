# JobRush Admin Portal (`jobrush_admin`)

Standalone React + Vite app for managing **Firebase Realtime Database** data used by JobRush.ai.

**Persistence:** Every data change from this portal (users, reports, payment QR, admin password/username) is written with the Firebase client SDK to Realtime Database and is durable server-side. The only browser-only state is the signed-in session flag in `sessionStorage` (8h), not your business data.

## Features

- **Dashboard** — live metrics: registered users, payments pending verification (`accessStatus: awaiting_activation`), interview report count, approximate online users (`lastSeenAt` heartbeat from the main app), and JobRush API health (Groq / TTS from `/api/health`)
- **User management** — table with IST timestamps, status (active / payment pending / awaiting verification / suspended), ATS & mock interview quotas (5/5), suspend/restore, delete, and **Approve payment** (for users awaiting verification) with approve/reject + transactional email via the JobRush API
- **Report management** — user-centric table: `atsReports` + `interviewReports`, view counts (up to 5 each), open detailed list, email latest reports via API, delete all for a user (resets usage counters on `userdb`)
- **Payment management** — upload or set URL for the UPI QR stored at `adminPortal/paymentQr` (shown on the client payment modal). If unset, the client uses the bundled file `jobrush_client/public/payment-phonepe-qr.png`, or `VITE_PAYMENT_QR_URL` when set.
- **Login** — username and password read from Firebase at `adminPortal/credentials` (seeded by the repo script). Session in `sessionStorage` (8h).
- **Settings** — change password; change admin login email/username (both under `adminPortal/credentials`).

## Setup

From the **repository root** (installs all workspaces):

```bash
npm install
```

Then from `jobrush_admin/` (or use `npm run admin:dev` from the repo root):

```bash
cd jobrush_admin
cp .env.example .env.local
# Fill VITE_FIREBASE_* from Firebase Console (same as main app)
npm run dev
```

From the **repository root**, seed the database (creates `adminPortal/credentials` with default login `sd.niladri@gmail.com` and password `JBRush@2026` if you use the bundled seed):

```bash
npm run firebase:create-collections
```

Local dev: **http://localhost:5174/jadm/** (base path is `/jadm`).

Production (same Netlify site as JobRush): **https://jbrush.netlify.app/jadm/** — the root `npm run build` copies `jobrush_admin/dist` into `dist/jadm`; see repo `netlify.toml` redirects.

## Build & deploy

```bash
npm run build
npm run preview
```

Deploy `dist/` to any static host (separate Netlify site, S3, etc.). Set the Firebase web config env vars in the host dashboard.

## Payment decisions (email disabled for now)

**Approve payment** / **Reject** only updates `userdb` in Firebase. Outbound notification email and API mail routes are not wired in the current build; they can be re-added later.

## Firebase rules

The admin app uses the **client SDK**. RTDB rules must allow read on `adminPortal/credentials` for login and write for password changes — or the portal cannot work. **Plain passwords in RTDB are sensitive:** restrict rules (e.g. no public read/write), deploy the admin app only on a trusted network, or move to Firebase Auth later.

**Repo template:** copy the contents of [`firebase-database.rules.json`](../firebase-database.rules.json) (repository root) into **Firebase Console → Realtime Database → Rules** and publish. That file allows read/write on `userdb`, `interviewReports`, `atsReports`, and `adminPortal` (credentials + payment QR) so the client and admin portals work without Firebase Auth. Replace with stricter rules before production if you can.

If you merge manually, you still need **all** of the above paths; admin-only rules are not enough — Report management and the client need `atsReports` / `interviewReports` / `userdb`.

The **client app** reads `adminPortal/paymentQr` to show the payment QR; tighten `.write` in production if possible (e.g. only server-side writes).

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
