# Firebase Setup for JobRush.ai

To push UniqueID and EmailID to Firebase Realtime Database, you need to configure the Firebase Web SDK.

## Steps

### 1. Get Firebase Web Config

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your **JobRush.ai** project (jobrush-f2eb4)
3. Click the **gear icon** → **Project settings**
4. Scroll to **Your apps** → Click **</>** (Web) to add a web app (or use existing)
5. Copy the `firebaseConfig` object

### 2. Create `.env.local`

Create a file `.env.local` in the project root with:

```
VITE_FIREBASE_API_KEY=your-actual-api-key
VITE_FIREBASE_AUTH_DOMAIN=jobrush-f2eb4.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://jobrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=jobrush-f2eb4
VITE_FIREBASE_STORAGE_BUCKET=jobrush-f2eb4.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-actual-app-id
```

Replace `your-actual-api-key` and `your-actual-app-id` with values from the Firebase Console.

### 3. Set Realtime Database Rules

In Firebase Console → **Realtime Database** → **Rules**, allow writes for both `userdb` and `interviewReports`:

```json
{
  "rules": {
    "userdb": {
      ".read": true,
      ".write": true
    },
    "interviewReports": {
      ".read": true,
      ".write": true
    }
  }
}
```

**Required:** Without `interviewReports` rules, saving Mock Interview reports will fail with `PERMISSION_DENIED`.

### 4. Restart Dev Server

After adding `.env.local`, restart: `npm run dev`

---

**Note:** The create script (`npm run firebase:create-collections`) now only sets `userdb/_schema` and does not overwrite existing user data.
