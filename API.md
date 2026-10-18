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
  - [GET /cards/autofill 🔒](#get-cardsautofill-)
  - [GET /cards/:id/sentences 🔒](#get-cardsidsentences-)
  - [POST /cards/:id/sentences 🔒](#post-cardsidsentences-)
- [Phrases](#phrases)
  - [GET /phrases 🔒](#get-phrases-)
  - [POST /phrases 🔒](#post-phrases-)
  - [GET /phrases/:id 🔒](#get-phrasesid-)
  - [PATCH /phrases/:id 🔒](#patch-phrasesid-)
  - [DELETE /phrases/:id 🔒](#delete-phrasesid-)
  - [POST /phrases/:id/generate 🔒](#post-phrasesidgenerate-)
  - [GET /phrases/:id/sentences 🔒](#get-phrasesidsentences-)
  - [POST /phrases/:id/sentences 🔒](#post-phrasesidsentences-)
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

Word cards. All card endpoints require a valid `lx_session` cookie and are **scoped to the authenticated user** — a user can never read or modify another user's cards.

Example sentences are stored separately, so in every card response **`example` is an array** of saved sentences (newest first), not a string. Sentences come from the `example` sent on create and from [`POST /cards/:id/sentences`](#post-cardsidsentences-).

**Path parameter `id`** must be a UUID. A malformed id is not validated yet and currently results in `500`.

**AI errors** (`autofill`, `POST /cards/:id/sentences`) respond `503` with one of: `"AI service error"`, `"Unexpected AI response"`, `"Failed to parse AI response"`, `"ANTHROPIC_API_KEY is not configured"`.

---

### `GET /cards` 🔒

List all cards for the current user, ordered by `addedAt` descending (newest first). No pagination.

Each card also includes `progress` — its practice state, or `null` if the word has never been practised.

**Response `200`** — empty array `[]` if no cards exist

```json
[
  {
    "id": "2c3ed35e-d497-4f85-a5e6-a087b9b3e4d5",
    "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
    "word": "ephemeral",
    "pos": "adjective",
    "pron": "/ɪˈfɛm(ə)rəl/",
    "explanation": "Lasting for a very short time.",
    "example": [
      {
        "id": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
        "sentence": "Cherry blossoms are ephemeral — gone in a week.",
        "createdAt": "2026-05-27T10:00:00.000Z"
      }
    ],
    "mastery": "learning",
    "streak": 0,
    "addedAt": "2026-05-27T10:00:00.000Z",
    "updatedAt": "2026-05-27T10:00:00.000Z",
    "progress": {
      "round1_completed": true,
      "round2_completed": false,
      "mode2_completed": false,
      "mode3_completed": false,
      "total_score": 1,
      "last_practiced": "2026-05-28T09:00:00.000Z"
    }
  }
]
```

**`progress` fields**

| Field | Type | Notes |
|-------|------|-------|
| `round1_completed` | boolean | Answered correctly in Round 1 at least once |
| `round2_completed` | boolean | Answered correctly in Round 2 at least once |
| `mode2_completed` | boolean | Answered correctly in Mode 2 at least once |
| `mode3_completed` | boolean | Answered correctly in Mode 3 at least once |
| `total_score` | integer | `0`–`4`; `4` means `mastery: "mastered"`. Drops by 1 after 7 days without practice, and again after 30 days |
| `last_practiced` | timestamp \| null | Last practice answer for this word |

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated |

---

### `POST /cards` 🔒

Create a word card. No AI call is made here — to pre-fill the fields, call [`GET /cards/autofill`](#get-cardsautofill-) first.

**Request body**

| Field | Required | Default | Validation |
|-------|----------|---------|------------|
| `word` | ✅ | — | non-empty string |
| `pos` | ✗ | `"noun"` | string |
| `pron` | ✗ | `""` | string |
| `explanation` | ✗ | `""` | string |
| `example` | ✗ | — | string; saved as the card's first example sentence |

Fields set by the server (not accepted from client): `id`, `userId`, `mastery` (`"learning"`), `streak` (`0`), `addedAt`, `updatedAt`.

**Minimal request**
```json
{ "word": "ephemeral" }
```

**Full request**
```json
{
  "word": "ephemeral",
  "pos": "adjective",
  "pron": "/ɪˈfɛm(ə)rəl/",
  "explanation": "Lasting for a very short time.",
  "example": "Cherry blossoms are ephemeral — gone in a week."
}
```

**Response `201`** — card object (without `progress`). Without `example` in the request, `example` is `[]`.

```json
{
  "id": "2c3ed35e-d497-4f85-a5e6-a087b9b3e4d5",
  "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
  "word": "ephemeral",
  "pos": "adjective",
  "pron": "/ɪˈfɛm(ə)rəl/",
  "explanation": "Lasting for a very short time.",
  "example": [
    {
      "id": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
      "sentence": "Cherry blossoms are ephemeral — gone in a week.",
      "createdAt": "2026-05-27T10:00:00.000Z"
    }
  ],
  "mastery": "learning",
  "streak": 0,
  "addedAt": "2026-05-27T10:00:00.000Z",
  "updatedAt": "2026-05-27T10:00:00.000Z"
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `word` missing or empty, or a field has the wrong type |
| `401` | Not authenticated |

---

### `GET /cards/:id` 🔒

Get a single card by ID.

**Path parameter:** `id` — UUID of the card.

**Response `200`** — card object, same shape as the `POST /cards` response (without `progress`)

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
| `example` | string | see note below |
| `mastery` | string | `"learning"` \| `"mastered"` |
| `streak` | integer | min 0 |

Notes:

- **`mastery`** is also managed by practice: every practice answer and the daily decay job recalculate it from `total_score`, so a manually set value is overwritten the next time the word is practised or decays.
- **`example`** updates the hidden example the AI uses as "do not repeat" context. It does **not** change the `example` array in responses — to add a visible sentence, use [`POST /cards/:id/sentences`](#post-cardsidsentences-).
- **`streak`** is stored as sent; the server never changes it.

`updatedAt` is always set to the current timestamp by the server.

**Request** (only include fields to update)
```json
{
  "explanation": "Lasting for a very short time; transitory.",
  "streak": 3
}
```

**Response `200`** — full updated card object, same shape as `GET /cards/:id`

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | Empty body or no recognised fields (`"No valid fields to update"`), or an invalid value |
| `401` | Not authenticated |
| `404` | Card not found or belongs to another user |

---

### `DELETE /cards/:id` 🔒

Permanently delete a card together with its example sentences, practice progress and saved practice errors.

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

### `GET /cards/autofill` 🔒

Ask AI to suggest the fields for a new card. **Nothing is saved** — show the result to the user, then send it to [`POST /cards`](#post-cards-) as `explanation`, `example` and `pos`.

**Query parameter:** `word` — the English word.

```
GET /cards/autofill?word=ephemeral
```

**Response `200`**

```json
{
  "explanation": "Lasting for a very short time.",
  "exampleSentence": "The beauty of the sunset was ephemeral, fading within minutes.",
  "partOfSpeech": "adjective"
}
```

`partOfSpeech` is one of: `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `conjunction`, `interjection`.

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `word` missing or empty (`"word is required"`) |
| `401` | Not authenticated |
| `503` | AI unavailable |

---

### `GET /cards/:id/sentences` 🔒

List all saved example sentences for a card, newest first. Same data as the `example` array in card responses.

**Path parameter:** `id` — UUID of the card.

**Response `200`**

```json
{
  "sentences": [
    {
      "id": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
      "sentence": "Cherry blossoms are ephemeral — gone in a week.",
      "createdAt": "2026-05-27T10:00:00.000Z"
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated |
| `404` | Card not found or belongs to another user |

---

### `POST /cards/:id/sentences` 🔒

Generate **2 new example sentences** with AI and save them to the card. No request body.

**Path parameter:** `id` — UUID of the card.

**Response `201`** — only the newly created sentences

```json
{
  "sentences": [
    {
      "id": "6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e",
      "sentence": "Fame on social media is often ephemeral, lasting only until the next trend.",
      "createdAt": "2026-05-27T10:05:00.000Z"
    },
    {
      "id": "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      "sentence": "Early photographers struggled to capture such ephemeral moments as a splash of water.",
      "createdAt": "2026-05-27T10:05:00.000Z"
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated |
| `404` | Card not found or belongs to another user |
| `503` | AI unavailable — nothing is saved |

---

## Phrases

Cards for set phrases and idioms, e.g. `to lay eyes on`. All phrase endpoints require a valid `lx_session` cookie and are **scoped to the authenticated user**.

Phrases are separate from word cards: they have no `pos`, `pron`, `mastery` or `streak`, and are never used in practice. The user only enters the phrase — the explanation (in English) and examples are generated by AI.

**Path parameter `id`** must be a UUID. Otherwise the server responds `400` with Nest's default body:

```json
{ "message": "Validation failed (uuid is expected)", "error": "Bad Request", "statusCode": 400 }
```

**AI errors** respond `503` with one of: `"AI service error"`, `"Unexpected AI response"`, `"Failed to parse AI response"`, `"ANTHROPIC_API_KEY is not configured"`.

---

### `GET /phrases` 🔒

List all phrases for the current user, ordered by `addedAt` descending (newest first). Each phrase includes all of its examples, newest first. No pagination.

**Response `200`** — empty array `[]` if no phrases exist

```json
[
  {
    "id": "7b1e2c4a-3f5d-4e6a-9b8c-1d2e3f4a5b6c",
    "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
    "phrase": "to lay eyes on",
    "explanation": "To see someone or something, especially for the first time.",
    "addedAt": "2026-10-18T10:00:00.000Z",
    "updatedAt": "2026-10-18T10:00:00.000Z",
    "examples": [
      {
        "id": "c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f",
        "sentence": "The moment she laid eyes on the old house, she knew she wanted to buy it.",
        "createdAt": "2026-10-18T10:00:00.000Z"
      }
    ]
  }
]
```

**Errors**

| Status | Condition |
|--------|-----------|
| `401` | Not authenticated |

---

### `POST /phrases` 🔒

Create a phrase. The server makes one AI call that fills `explanation` and adds **1 example**, so the request takes a few seconds.

If AI is unavailable, the phrase is **still created** (`201`) with `explanation: ""` and `examples: []`. Fill it later with [`POST /phrases/:id/generate`](#post-phrasesidgenerate-).

**Request body**

| Field | Required | Validation |
|-------|----------|------------|
| `phrase` | ✅ | non-empty string; leading/trailing whitespace is trimmed |

```json
{ "phrase": "to lay eyes on" }
```

**Response `201`** — full phrase object (same shape as in `GET /phrases`)

```json
{
  "id": "7b1e2c4a-3f5d-4e6a-9b8c-1d2e3f4a5b6c",
  "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
  "phrase": "to lay eyes on",
  "explanation": "To see someone or something, especially for the first time.",
  "addedAt": "2026-10-18T10:00:00.000Z",
  "updatedAt": "2026-10-18T10:00:00.000Z",
  "examples": [
    {
      "id": "c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f",
      "sentence": "The moment she laid eyes on the old house, she knew she wanted to buy it.",
      "createdAt": "2026-10-18T10:00:00.000Z"
    }
  ]
}
```

**Response `201` when AI was unavailable**

```json
{
  "id": "7b1e2c4a-3f5d-4e6a-9b8c-1d2e3f4a5b6c",
  "userId": "9df14559-af06-4a5e-8509-d99638bc6152",
  "phrase": "to lay eyes on",
  "explanation": "",
  "addedAt": "2026-10-18T10:00:00.000Z",
  "updatedAt": "2026-10-18T10:00:00.000Z",
  "examples": []
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `phrase` missing, empty or whitespace only |
| `401` | Not authenticated |

---

### `GET /phrases/:id` 🔒

Get a single phrase by ID.

**Path parameter:** `id` — UUID of the phrase.

**Response `200`** — full phrase object (same shape as above)

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `id` is not a UUID |
| `401` | Not authenticated |
| `404` | Phrase not found or belongs to another user |

---

### `PATCH /phrases/:id` 🔒

Manually edit a phrase. Send only the fields you want to change. Examples are not affected.

**Path parameter:** `id` — UUID of the phrase.

**Updatable fields**

| Field | Type | Validation |
|-------|------|------------|
| `phrase` | string | non-empty; trimmed |
| `explanation` | string | — |

```json
{ "explanation": "To see something for the first time." }
```

**Response `200`** — full updated phrase object

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | No recognised fields, `phrase` empty, or `id` is not a UUID |
| `401` | Not authenticated |
| `404` | Phrase not found or belongs to another user |

---

### `DELETE /phrases/:id` 🔒

Permanently delete a phrase together with all its examples.

**Path parameter:** `id` — UUID of the phrase.

**Response `200`**

```json
{ "ok": true }
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `id` is not a UUID |
| `401` | Not authenticated |
| `404` | Phrase not found or belongs to another user |

---

### `POST /phrases/:id/generate` 🔒

Ask AI again for the explanation and 1 example. Intended for phrases created while AI was unavailable (`explanation: ""`), but works for any phrase.

- `explanation` is **overwritten**, including a manually edited one
- 1 new example is **added**; existing examples are kept

**Path parameter:** `id` — UUID of the phrase. No request body.

**Response `201`** — full updated phrase object

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `id` is not a UUID |
| `401` | Not authenticated |
| `404` | Phrase not found or belongs to another user |
| `503` | AI unavailable — nothing is changed |

---

### `GET /phrases/:id/sentences` 🔒

List all saved examples for a phrase, newest first.

**Path parameter:** `id` — UUID of the phrase.

**Response `200`**

```json
{
  "sentences": [
    {
      "id": "c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f",
      "sentence": "The moment she laid eyes on the old house, she knew she wanted to buy it.",
      "createdAt": "2026-10-18T10:00:00.000Z"
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `id` is not a UUID |
| `401` | Not authenticated |
| `404` | Phrase not found or belongs to another user |

---

### `POST /phrases/:id/sentences` 🔒

Generate **1 new example** with AI and save it. Existing examples are sent to AI so the new one does not repeat them.

**Path parameter:** `id` — UUID of the phrase. No request body.

**Response `201`** — only the newly created example

```json
{
  "sentences": [
    {
      "id": "e8f9a0b1-c2d3-4e4f-8a5b-6c7d8e9f0a1b",
      "sentence": "I had never laid eyes on such a beautiful sunset before that trip.",
      "createdAt": "2026-10-18T10:05:00.000Z"
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `id` is not a UUID |
| `401` | Not authenticated |
| `404` | Phrase not found or belongs to another user |
| `503` | AI unavailable — nothing is saved |

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
| `word` | string | The English word (phrases are separate — see [PhraseCard](#phrasecard)) |
| `pos` | string | Part of speech, default `"noun"`. Free string; autofill returns `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `conjunction` or `interjection` |
| `pron` | string | Pronunciation, e.g. IPA `/ɪˈfɛm(ə)rəl/`; default `""` |
| `explanation` | string | Plain-English definition; default `""` |
| `example` | CardExample[] | Saved example sentences, newest first |
| `mastery` | enum | `"learning"` \| `"mastered"`, default `"learning"`; recalculated by practice |
| `streak` | integer | min 0, default `0`; stored as sent by the client |
| `addedAt` | timestamp | Set on creation |
| `updatedAt` | timestamp | Updated on every write |
| `progress` | object \| null | Only in `GET /cards` — see [`progress` fields](#get-cards-) |

### CardExample

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `sentence` | string | From `example` on create, or AI-generated |
| `createdAt` | timestamp | Set on creation |

Stored in the `card_sentences` table; deleted together with the card.

### PhraseCard

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → User; cascade delete |
| `phrase` | string | The English phrase, e.g. `to lay eyes on` |
| `explanation` | string | English explanation from AI; `""` if AI was unavailable on create |
| `addedAt` | timestamp | Set on creation |
| `updatedAt` | timestamp | Updated on every write |
| `examples` | PhraseExample[] | Not a column — added to every phrase response, newest first |

### PhraseExample

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `sentence` | string | AI-generated example sentence |
| `createdAt` | timestamp | Set on creation |

Stored in the `phrase_sentences` table; deleted together with the phrase.

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
| `GET` | `/cards` | 🔒 | `200` | List all cards with examples + progress |
| `POST` | `/cards` | 🔒 | `201` | Create card (no AI) |
| `GET` | `/cards/:id` | 🔒 | `200` | Get one card |
| `PATCH` | `/cards/:id` | 🔒 | `200` | Partial update |
| `DELETE` | `/cards/:id` | 🔒 | `200` | Delete card |
| `GET` | `/cards/autofill?word=` | 🔒 | `200` | AI suggestion for a new card (not saved) |
| `GET` | `/cards/:id/sentences` | 🔒 | `200` | List example sentences |
| `POST` | `/cards/:id/sentences` | 🔒 | `201` | Generate 2 more example sentences |
| `GET` | `/phrases` | 🔒 | `200` | List all phrases with examples |
| `POST` | `/phrases` | 🔒 | `201` | Create phrase; AI adds explanation + 1 example |
| `GET` | `/phrases/:id` | 🔒 | `200` | Get one phrase |
| `PATCH` | `/phrases/:id` | 🔒 | `200` | Edit phrase / explanation |
| `DELETE` | `/phrases/:id` | 🔒 | `200` | Delete phrase and its examples |
| `POST` | `/phrases/:id/generate` | 🔒 | `201` | Regenerate explanation + add 1 example |
| `GET` | `/phrases/:id/sentences` | 🔒 | `200` | List examples |
| `POST` | `/phrases/:id/sentences` | 🔒 | `201` | Generate 1 more example |
