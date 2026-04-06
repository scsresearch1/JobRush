# JobRush.ai Database Configuration

## Adding New Fields or Collections

**Always use the create script first:**

1. Edit `scripts/create-firebase-collections.js` – add the new collection/field to `COLLECTION_STRUCTURE`
2. Run `npm run firebase:create-collections`
3. Update `src/config/databaseSchema.js` to match
4. Update `src/services/database.js` if new operations are needed

---

## Schema Reference

Use this when accessing the database from any page in the application.

### userdb Collection

| Field     | Type   | Description                    |
|----------|--------|--------------------------------|
| UniqueID | string | Unique identifier for the user |
| EmailID  | string | User's email address           |
| Timestamp| string | ISO 8601 timestamp when created|

### interviewReports Collection

| Field          | Type   | Description                                      |
|----------------|--------|--------------------------------------------------|
| userId         | string | User unique ID or 'anonymous'                     |
| report         | object | Full behavioral report (overall, questionTimelines) |
| recommendations| array  | LLM-generated Interview Edge tips                |
| generatedAt    | string | ISO 8601 timestamp                                |

### Usage in Pages

```javascript
// Import the database service
import { saveUser, getUser, getUserByEmail, userdbRef, USERDB_FIELDS } from '../services/database'

// Save a user (e.g. on registration)
await saveUser(uniqueId, email)

// Get a user by UniqueID
const user = await getUser(uniqueId)

// Get user by email
const { uniqueId, data } = await getUserByEmail('user@example.com')

// Use schema constants
console.log(USERDB_FIELDS.UNIQUE_ID)  // 'UniqueID'
console.log(USERDB_FIELDS.EMAIL_ID)   // 'EmailID'

// Save interview report (Mock Interview analysis)
import { saveInterviewReport } from '../services/database'
const reportId = await saveInterviewReport(userId, report, recommendations)
```

### Firebase Setup

1. Copy `.env.example` to `.env.local`
2. Get your Firebase web config from: Firebase Console → Project Settings → General → Your apps
3. Add the web app if not already added, then copy the config values
4. **Realtime Database Rules**: In Firebase Console → Realtime Database → Rules, ensure rules allow read/write (for development you may use temporary permissive rules)
