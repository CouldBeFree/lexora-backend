# Lexora — Backend API Specification

This document describes the REST API that the Lexora frontend expects.  
The backend is a **separate project** — choose any language, framework, and database you prefer.

---

## 1. Overview

| Concern | Requirement |
|---|---|
| Protocol | HTTP/HTTPS, JSON request and response bodies |
| Auth mechanism | HTTP-only cookie named `lx_session` containing a signed JWT |
| CORS | Allow requests from the frontend origin with `credentials: true` |
| Content-Type | `application/json` for all endpoints |
| Error shape | `{ "message": "Human-readable string" }` with an appropriate HTTP status code |

The frontend runs at `http://localhost:3000` in development.  
The backend can run on any port (e.g. `4000`); configure CORS accordingly.

---

## 2. Authentication

### Session model

- On successful login or registration, the server issues a **JWT** stored in an **HTTP-only cookie** (`lx_session`).
- The cookie must be set with: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` (30 days). Use `Secure` in production.
- Every protected endpoint reads the cookie, verifies the JWT, and extracts the `userId`.
- On logout, the server clears the cookie.

### JWT payload

```json
{ "sub": "<userId>", "iat": 1234567890, "exp": 1234567890 }
```

### Google OAuth flow

1. Frontend navigates the browser to `GET /auth/google`.
2. Server redirects to Google's consent screen.
3. Google redirects back to `GET /auth/google/callback?code=...`.
4. Server exchanges the code for an access token, fetches the user's profile from Google, creates or links the account, sets the session cookie, and redirects the browser to `/vocabulary`.

Account linking rule: if a user signs in with Google and the Google email already exists in the database (from an email/password registration), link the Google ID to that existing account rather than creating a duplicate.

---

## 3. Data Models

### User

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | string | Unique |
| `name` | string | |
| `passwordHash` | string \| null | `null` for Google-only accounts |
| `googleId` | string \| null | `null` for email/password-only accounts |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### VocabCard

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → User; cascade delete |
| `word` | string | The English word or phrase |
| `pos` | string | Part of speech: `noun`, `verb`, `adj.`, `adv.`, `phrase`, `idiom` |
| `pron` | string | IPA pronunciation, e.g. `/ɪˈfɛm(ə)rəl/` |
| `explanation` | string | Plain-English definition |
| `example` | string | Example sentence |
| `mastery` | enum | `new` \| `learning` \| `mastered` |
| `streak` | integer | Consecutive-day review count, min 0 |
| `addedAt` | timestamp | Set on creation |
| `updatedAt` | timestamp | Updated on every write |

---

## 4. API Endpoints

### Auth

---

#### `POST /auth/register`

Create a new account with email and password.

**Request body**

| Field | Required | Validation |
|---|---|---|
| `name` | ✅ | non-empty string |
| `email` | ✅ | valid email format |
| `password` | ✅ | min 8 characters |

**Responses**

| Status | Condition | Body |
|---|---|---|
| `201` | Account created | `{ id, name, email }` + sets `lx_session` cookie |
| `400` | Missing or invalid fields | `{ message }` |
| `409` | Email already registered | `{ message }` |

---

#### `POST /auth/login`

Sign in with email and password.

**Request body**

| Field | Required | Validation |
|---|---|---|
| `email` | ✅ | valid email format |
| `password` | ✅ | non-empty string |

**Responses**

| Status | Condition | Body |
|---|---|---|
| `200` | Credentials valid | `{ id, name, email }` + sets `lx_session` cookie |
| `400` | Missing or invalid fields | `{ message }` |
| `401` | Wrong email or password | `{ message }` |

---

#### `POST /auth/logout`

Clear the session cookie. No request body required.

**Responses**

| Status | Body |
|---|---|
| `200` | `{ ok: true }` + clears `lx_session` cookie |

---

#### `GET /auth/me` 🔒

Return the currently authenticated user.

**Responses**

| Status | Condition | Body |
|---|---|---|
| `200` | Valid session | `{ id, name, email }` |
| `401` | No or invalid session cookie | `{ message }` |

---

#### `GET /auth/google`

Redirect the browser to Google's OAuth consent screen. No request body.

**Response:** `302` redirect to Google.

---

#### `GET /auth/google/callback`

OAuth callback. Google appends `?code=...` (success) or `?error=...` (denied) to this URL.

- On success: exchange code → fetch Google profile → create or link account → set cookie → redirect to `/vocabulary`.
- On error/denial: redirect to `/auth?error=google_denied`.

---

### Cards

All card endpoints require a valid `lx_session` cookie. Return `401` if missing or invalid.  
All operations are scoped to the authenticated user — a user can never read or modify another user's cards.

---

#### `GET /cards` 🔒

List all cards for the current user, ordered by `addedAt` descending (newest first).

**Response `200`**

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "word": "ephemeral",
    "pos": "adj.",
    "pron": "/ɪˈfɛm(ə)rəl/",
    "explanation": "Lasting for a very short time.",
    "example": "Cherry blossoms are ephemeral — gone in a week.",
    "mastery": "new",
    "streak": 0,
    "addedAt": "2026-05-27T10:00:00.000Z",
    "updatedAt": "2026-05-27T10:00:00.000Z"
  }
]
```

Returns an empty array `[]` if the user has no cards.

---

#### `POST /cards` 🔒

Create a new vocabulary card.

**Request body fields**

| Field | Required | Validation | Default |
|---|---|---|---|
| `word` | ✅ | non-empty string | — |
| `pos` | ✗ | string | `"noun"` |
| `pron` | ✗ | string | `""` |
| `explanation` | ✗ | string | `""` |
| `example` | ✗ | string | `""` |

Fields set by the server (do not accept from client):

| Field | Server value |
|---|---|
| `id` | Random UUID |
| `userId` | From session cookie |
| `mastery` | `"new"` |
| `streak` | `0` |
| `addedAt` | Current timestamp |
| `updatedAt` | Current timestamp |

**Minimal valid request**
```json
{ "word": "ephemeral" }
```

**Full request**
```json
{
  "word": "ephemeral",
  "pos": "adj.",
  "pron": "/ɪˈfɛm(ə)rəl/",
  "explanation": "Lasting for a very short time.",
  "example": "Cherry blossoms are ephemeral — gone in a week."
}
```

**Responses**

| Status | Condition | Body |
|---|---|---|
| `201` | Created | Full card object (all fields) |
| `400` | `word` missing or empty | `{ message }` |
| `401` | Not authenticated | `{ message }` |

---

#### `GET /cards/:id` 🔒

Get a single card by ID.

**Responses**

| Status | Condition | Body |
|---|---|---|
| `200` | Found and belongs to user | Full card object |
| `401` | Not authenticated | `{ message }` |
| `404` | Not found or belongs to another user | `{ message }` |

---

#### `PATCH /cards/:id` 🔒

Partially update a card. Only send the fields you want to change.

**Updatable fields**

| Field | Type | Validation |
|---|---|---|
| `word` | string | non-empty |
| `pos` | string | |
| `pron` | string | |
| `explanation` | string | |
| `example` | string | |
| `mastery` | string | must be `new`, `learning`, or `mastered` |
| `streak` | integer | min 0 |

The server must always update `updatedAt` to the current timestamp.  
Reject requests with no recognised fields or an empty body.

**Responses**

| Status | Condition | Body |
|---|---|---|
| `200` | Updated | Full updated card object |
| `400` | Invalid fields or empty body | `{ message }` |
| `401` | Not authenticated | `{ message }` |
| `404` | Not found or belongs to another user | `{ message }` |

---

#### `DELETE /cards/:id` 🔒

Delete a card permanently.

**Responses**

| Status | Condition | Body |
|---|---|---|
| `200` | Deleted | `{ ok: true }` |
| `401` | Not authenticated | `{ message }` |
| `404` | Not found or belongs to another user | `{ message }` |

---

## 5. Summary Table

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | ✗ | Create account |
| `POST` | `/auth/login` | ✗ | Sign in |
| `POST` | `/auth/logout` | ✗ | Sign out |
| `GET` | `/auth/me` | 🔒 | Get current user |
| `GET` | `/auth/google` | ✗ | Start Google OAuth |
| `GET` | `/auth/google/callback` | ✗ | Google OAuth callback |
| `GET` | `/cards` | 🔒 | List all cards |
| `POST` | `/cards` | 🔒 | Create card |
| `GET` | `/cards/:id` | 🔒 | Get one card |
| `PATCH` | `/cards/:id` | 🔒 | Update card (partial) |
| `DELETE` | `/cards/:id` | 🔒 | Delete card |
