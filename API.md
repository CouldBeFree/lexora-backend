# Lexora API

**Base URL (dev):** `http://localhost:3010`  
**Auth:** HTTP-only cookie `lx_session` (JWT, 30-day TTL).  
**Content-Type:** `application/json` for all requests and responses.  
**Error shape:** `{ "message": "Human-readable string" }` with an appropriate HTTP status.

---

## Table of Contents

- [Authentication](#authentication)
  - [POST /auth/register](#post-authregister)
  - [POST /auth/login](#post-authlogin)
  - [POST /auth/logout](#post-authlogout)
  - [GET /auth/me 🔒](#get-authme-)
  - [GET /auth/google](#get-authgoogle)
  - [GET /auth/google/callback](#get-authgooglecallback)
- [Cards](#cards)
  - [GET /cards 🔒](#get-cards-)
  - [POST /cards 🔒](#post-cards-)
  - [GET /cards/:id 🔒](#get-cardsid-)
  - [PATCH /cards/:id 🔒](#patch-cardsid-)
  - [DELETE /cards/:id 🔒](#delete-cardsid-)
- [Data Models](#data-models)

🔒 = requires a valid `lx_session` cookie

---

## Authentication

### `POST /auth/register`

Create a new account with email and password. Sets the session cookie on success.

**Request body**

| Field | Required | Validation |
|-------|----------|------------|
| `name` | ✅ | non-empty string |
| `email` | ✅ | valid email format |
| `password` | ✅ | min 8 characters |

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "s3cr3t!pw"
}
```

**Response `201`** — sets `lx_session` cookie

```json
{
  "id": "9df14559-af06-4a5e-8509-d99638bc6152",
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | Missing or invalid fields |
| `409` | Email already registered |

---

### `POST /auth/login`

Sign in with email and password. Sets the session cookie on success.

**Request body**

| Field | Required | Validation |
|-------|----------|------------|
| `email` | ✅ | valid email format |
| `password` | ✅ | non-empty string |

```json
{
  "email": "alice@example.com",
  "password": "s3cr3t!pw"
}
```

**Response `200`** — sets `lx_session` cookie

```json
{
  "id": "9df14559-af06-4a5e-8509-d99638bc6152",
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | Missing or invalid fields |
| `401` | Wrong email or password |

---

### `POST /auth/logout`

Clear the session cookie. No request body needed.

**Response `200`** — clears `lx_session` cookie

```json
{ "ok": true }
```

---

### `GET /auth/me` 🔒

Return the currently authenticated user.

**Response `200`**

```json
{
  "id": "9df14559-af06-4a5e-8509-d99638bc6152",
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | No or invalid session cookie |

---

### `GET /auth/google`

Redirect the browser to Google's OAuth consent screen.

**Response:** `302` redirect to Google.

> Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

---

### `GET /auth/google/callback`

OAuth callback URL. Google appends `?code=...` on success or `?error=...` on denial.

- **Success:** exchanges code → fetches Google profile → creates or links account → sets `lx_session` → redirects browser to `{FRONTEND_URL}/vocabulary`.
- **Account linking:** if the Google email already exists from an email/password signup, the Google ID is linked to that account rather than creating a duplicate.
- **Denial / error:** redirects browser to `{FRONTEND_URL}/auth?error=google_denied`.

---

## Cards

All card endpoints require a valid `lx_session` cookie and are **scoped to the authenticated user** — a user can never read or modify another user's cards.

---

### `GET /cards` 🔒

List all cards for the current user, ordered by `addedAt` descending (newest first).

**Response `200`** — empty array `[]` if no cards exist

```json
[
  {
    "id": "2c3ed35e-d497-4f85-a5e6-a087b9b3e4d5",
    "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
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

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated |

---

### `POST /cards` 🔒

Create a new vocabulary card.

**Request body**

| Field | Required | Default | Validation |
|-------|----------|---------|------------|
| `word` | ✅ | — | non-empty string |
| `pos` | ✗ | `"noun"` | string |
| `pron` | ✗ | `""` | string |
| `explanation` | ✗ | `""` | string |
| `example` | ✗ | `""` | string |

Fields set by the server (not accepted from client): `id`, `userId`, `mastery` (`"new"`), `streak` (`0`), `addedAt`, `updatedAt`.

**Minimal request**
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

**Response `201`** — full card object

```json
{
  "id": "2c3ed35e-d497-4f85-a5e6-a087b9b3e4d5",
  "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
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
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `word` missing or empty |
| `401` | Not authenticated |

---

### `GET /cards/:id` 🔒

Get a single card by ID.

**Path parameter:** `id` — UUID of the card.

**Response `200`** — full card object (same shape as above)

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated |
| `404` | Card not found or belongs to another user |

---

### `PATCH /cards/:id` 🔒

Partially update a card. Send only the fields you want to change; all others are preserved.

**Path parameter:** `id` — UUID of the card.

**Updatable fields**

| Field | Type | Validation |
|-------|------|------------|
| `word` | string | non-empty |
| `pos` | string | — |
| `pron` | string | — |
| `explanation` | string | — |
| `example` | string | — |
| `mastery` | string | `"new"` \| `"learning"` \| `"mastered"` |
| `streak` | integer | min 0 |

`updatedAt` is always set to the current timestamp by the server.

**Request** (only include fields to update)
```json
{
  "mastery": "learning",
  "streak": 3
}
```

**Response `200`** — full updated card object

```json
{
  "id": "2c3ed35e-d497-4f85-a5e6-a087b9b3e4d5",
  "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
  "word": "ephemeral",
  "pos": "adj.",
  "pron": "/ɪˈfɛm(ə)rəl/",
  "explanation": "Lasting for a very short time.",
  "example": "Cherry blossoms are ephemeral — gone in a week.",
  "mastery": "learning",
  "streak": 3,
  "addedAt": "2026-05-27T10:00:00.000Z",
  "updatedAt": "2026-05-27T10:05:00.000Z"
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | Empty body or no recognised fields |
| `401` | Not authenticated |
| `404` | Card not found or belongs to another user |

---

### `DELETE /cards/:id` 🔒

Permanently delete a card.

**Path parameter:** `id` — UUID of the card.

**Response `200`**

```json
{ "ok": true }
```

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated |
| `404` | Card not found or belongs to another user |

---

## Data Models

### User

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `email` | string | Unique |
| `name` | string | |
| `passwordHash` | string \| null | `null` for Google-only accounts |
| `googleId` | string \| null | `null` for email/password-only accounts |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

> `passwordHash` and `googleId` are never exposed in API responses.

### VocabCard

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → User; cascade delete |
| `word` | string | The English word or phrase |
| `pos` | string | Part of speech: `noun`, `verb`, `adj.`, `adv.`, `phrase`, `idiom` |
| `pron` | string | IPA pronunciation, e.g. `/ɪˈfɛm(ə)rəl/` |
| `explanation` | string | Plain-English definition |
| `example` | string | Example sentence |
| `mastery` | enum | `"new"` \| `"learning"` \| `"mastered"` |
| `streak` | integer | Consecutive-day review count, min 0 |
| `addedAt` | timestamp | Set on creation |
| `updatedAt` | timestamp | Updated on every write |

---

## Quick Reference

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| `POST` | `/auth/register` | — | `201` | Create account + set cookie |
| `POST` | `/auth/login` | — | `200` | Sign in + set cookie |
| `POST` | `/auth/logout` | — | `200` | Clear cookie |
| `GET` | `/auth/me` | 🔒 | `200` | Get current user |
| `GET` | `/auth/google` | — | `302` | Start Google OAuth |
| `GET` | `/auth/google/callback` | — | `302` | Google OAuth callback |
| `GET` | `/cards` | 🔒 | `200` | List all cards |
| `POST` | `/cards` | 🔒 | `201` | Create card |
| `GET` | `/cards/:id` | 🔒 | `200` | Get one card |
| `PATCH` | `/cards/:id` | 🔒 | `200` | Partial update |
| `DELETE` | `/cards/:id` | 🔒 | `200` | Delete card |
