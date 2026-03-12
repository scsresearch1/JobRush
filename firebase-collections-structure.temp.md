# JobRush Firebase Firestore Collection Structure

> **Temporary reference file** – Use this to set up your Firestore database. Delete when no longer needed.

---

## Collection Overview

| Collection | Description |
|------------|-------------|
| `users` | User profiles (email-based registration) |
| `resumes` | Uploaded CVs and parsed resume data |
| `ats_scores` | ATS compatibility scores per target |
| `ats_reports` | Detailed ATS analysis reports |
| `resume_improvements` | AI suggestions and applied corrections |
| `sop_cover_letters` | Generated SOPs and cover letters |
| `mock_interviews` | Mock interview sessions |
| `interview_responses` | Subcollection: responses per interview |
| `interview_analysis` | Performance, confidence, emotion analysis |

---

## 1. `users`

User registration and profile data.

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Firebase Auth UID (or custom ID) |
| `email` | string | User email |
| `name` | string | Full name |
| `phone` | string | (optional) Phone number |
| `linkedin` | string | (optional) LinkedIn URL |
| `createdAt` | timestamp | Account creation time |
| `updatedAt` | timestamp | Last profile update |

**Document ID:** `{uid}` or auto-generated

---

## 2. `resumes`

Uploaded resumes and parsed structured data.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to `users.uid` |
| `fileUrl` | string | Firebase Storage URL of uploaded PDF |
| `fileName` | string | Original file name |
| `fileSize` | number | File size in bytes |
| `parsedData` | map | Extracted structured data (see below) |
| `parseStatus` | string | `pending` \| `processing` \| `completed` \| `failed` |
| `createdAt` | timestamp | Upload time |
| `updatedAt` | timestamp | Last update |

**`parsedData` structure:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "skills": ["string"],
  "experience": [
    { "title": "string", "company": "string", "duration": "string", "description": "string" }
  ],
  "education": [
    { "degree": "string", "institution": "string", "year": "string" }
  ],
  "projects": [
    { "name": "string", "description": "string", "technologies": ["string"] }
  ]
}
```

**Document ID:** auto-generated

---

## 3. `ats_scores`

ATS compatibility scores per company/university.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to `users.uid` |
| `resumeId` | string | Reference to `resumes` document |
| `targetName` | string | Company or university name |
| `targetType` | string | `company` \| `university` |
| `score` | number | 0–100 compatibility score |
| `evaluatedAt` | timestamp | When score was calculated |

**Document ID:** auto-generated

**Indexes:** `userId`, `resumeId`, `targetType`

---

## 4. `ats_reports`

Detailed ATS analysis reports (scientific breakdown).

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to `users.uid` |
| `resumeId` | string | Reference to `resumes` document |
| `targetName` | string | Company/university evaluated for |
| `sections` | array | Score breakdown per section (see below) |
| `keywords` | map | `{ found: ["string"], missing: ["string"] }` |
| `formattingIssues` | array | List of formatting problems |
| `skillAlignment` | map | Skill match analysis |
| `createdAt` | timestamp | Report generation time |

**`sections` item structure:**
```json
{
  "name": "string (e.g. Keyword Matching, Formatting)",
  "score": "number",
  "status": "good | medium | poor",
  "details": "string"
}
```

**Document ID:** auto-generated

---

## 5. `resume_improvements`

AI-generated improvement suggestions and applied corrections.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to `users.uid` |
| `resumeId` | string | Reference to `resumes` document |
| `recommendations` | array | List of suggestions (see below) |
| `appliedCorrections` | array | IDs or indices of applied items |
| `createdAt` | timestamp | When suggestions were generated |
| `updatedAt` | timestamp | Last correction applied |

**`recommendations` item structure:**
```json
{
  "id": "string",
  "section": "string (Skills, Projects, Achievements, Keywords)",
  "current": "string",
  "suggestion": "string",
  "impact": "high | medium | low",
  "applied": "boolean"
}
```

**Document ID:** auto-generated

---

## 6. `sop_cover_letters`

Generated SOPs and cover letters.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to `users.uid` |
| `resumeId` | string | Reference to `resumes` document |
| `type` | string | `sop` \| `cover_letter` |
| `targetRole` | string | Target job role |
| `targetCompany` | string | Target company or university |
| `content` | string | Generated document text |
| `createdAt` | timestamp | Generation time |

**Document ID:** auto-generated

---

## 7. `mock_interviews`

Mock interview sessions.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to `users.uid` |
| `status` | string | `in_progress` \| `completed` |
| `questionCount` | number | Total questions in session |
| `completedCount` | number | Questions answered |
| `startedAt` | timestamp | Session start |
| `completedAt` | timestamp | (optional) Session end |

**Document ID:** auto-generated

**Subcollection:** `responses` (see below)

---

## 8. `mock_interviews/{interviewId}/responses`

Individual responses within a mock interview.

| Field | Type | Description |
|-------|------|-------------|
| `questionIndex` | number | Index of question (0-based) |
| `question` | string | Question text |
| `videoUrl` | string | Firebase Storage URL of video response |
| `audioUrl` | string | (optional) Audio-only URL |
| `duration` | number | Response duration in seconds |
| `createdAt` | timestamp | When response was recorded |

**Document ID:** auto-generated or `question_{index}`

---

## 9. `interview_analysis`

Analysis of mock interview performance.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to `users.uid` |
| `interviewId` | string | Reference to `mock_interviews` document |
| `confidenceScore` | number | 0–100 confidence rating |
| `responseQualityScore` | number | 0–100 quality rating |
| `emotionSignals` | map | Emotional indicators from response |
| `recommendations` | array | Improvement suggestions |
| `createdAt` | timestamp | Analysis generation time |

**`recommendations` item:**
```json
{
  "type": "string (e.g. clarity, structure, engagement)",
  "text": "string",
  "priority": "high | medium | low"
}
```

**Document ID:** auto-generated

---

## Relationships Diagram

```
users (1) ────< resumes (many)
    │
    ├───< ats_scores (many)
    ├───< ats_reports (many)
    ├───< resume_improvements (many)
    ├───< sop_cover_letters (many)
    ├───< mock_interviews (many)
    │         └─── responses (subcollection)
    └───< interview_analysis (many)

resumes (1) ────< ats_scores (many)
resumes (1) ────< ats_reports (many)
resumes (1) ────< resume_improvements (many)
resumes (1) ────< sop_cover_letters (many)
mock_interviews (1) ────< interview_analysis (1)
```

---

## Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /resumes/{resumeId} {
      allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    match /ats_scores/{docId} {
      allow read, write: if request.auth != null;
    }
    match /ats_reports/{docId} {
      allow read, write: if request.auth != null;
    }
    match /resume_improvements/{docId} {
      allow read, write: if request.auth != null;
    }
    match /sop_cover_letters/{docId} {
      allow read, write: if request.auth != null;
    }
    match /mock_interviews/{interviewId} {
      allow read, write: if request.auth != null;
      match /responses/{responseId} {
        allow read, write: if request.auth != null;
      }
    }
    match /interview_analysis/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Firebase Storage Structure (for files)

```
resumes/{userId}/{resumeId}.pdf
interview_videos/{userId}/{interviewId}/{responseId}.webm
```

---

*Generated for JobRush project. Delete this file when no longer needed.*
