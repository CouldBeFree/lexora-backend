# Lexora Backend

NestJS REST API for a vocabulary learning app. TypeScript, TypeORM, PostgreSQL.

## Stack

- **Framework:** NestJS 11
- **ORM:** TypeORM 1.x (`synchronize: true` in **all** environments, dev and prod — schema is built from entities, no migrations runner)
- **Database:** PostgreSQL (host port 5434 in dev, not 5432; inside Docker the API reaches it as `postgres:5432`)
- **Auth:** JWT in `lx_session` httpOnly cookie (30-day expiry), Google OAuth 2.0
- **AI:** `@anthropic-ai/sdk`, model `claude-sonnet-4-6`
- **Cron:** `@nestjs/schedule` with `ScheduleModule.forRoot()` in AppModule

## Environment variables

Template: `.env.example`.

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5434
POSTGRES_DB=lexora
POSTGRES_USER=lexora
POSTGRES_PASSWORD=lexora_dev_password
JWT_SECRET=...                 # falls back to 'fallback_secret' — must be set in prod
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...           # optional; blank → strategy uses 'DISABLED', Google routes won't work
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3010/auth/google/callback
FRONTEND_URL=http://localhost:3000   # CORS origin + OAuth redirect target
PORT=3010
NODE_ENV=development           # 'production' adds the `secure` flag to the lx_session cookie
VAPID_PUBLIC_KEY=...           # Web Push for phrase reminders; generate with `npx web-push generate-vapid-keys`
VAPID_PRIVATE_KEY=...          # any VAPID_* blank → push disabled (GET /push/public-key → 503, cron idle)
VAPID_SUBJECT=mailto:...       # contact the push services can reach; must be mailto: or https:
```

## Running locally

```bash
docker compose up -d postgres   # only postgres, on host port 5434
npm run start:dev               # watch mode, http://localhost:3010
```

Plain `docker compose up -d` also starts the `api` container on `PORT`, which collides with `npm run start:dev`.

## Deployment

Push to a `release-*` branch → `.github/workflows/deploy.yml` builds `ghcr.io/couldbefree/lexora-be`, scp's `docker-compose.prod.yml` + `docker/postgres/init` to `/opt/apps/lexora-backend`, then ssh's in and runs `docker compose pull && up -d`. Full details in `DEPLOY.md`.

- `appleboy/ssh-action` runs the script line by line — keep every command single-line (no multi-line `if/else`).
- `docker/postgres/init/01-init.sql` enables `uuid-ossp` + `pgcrypto` on first DB boot.

## Project structure

```
src/
├── app.module.ts              # root module — registers all modules + ScheduleModule
├── main.ts                    # bootstrap: cookieParser, CORS, global ValidationPipe
│
├── auth/                      # authentication
│   ├── auth.controller.ts     # POST /auth/register|login|logout, GET /auth/me|google|google/callback
│   ├── auth.service.ts        # password validation, JWT signing, Google upsert, cookie helpers
│   ├── auth.module.ts
│   ├── dto/                   # RegisterDto, LoginDto
│   ├── guards/
│   │   ├── jwt-auth.guard.ts  # JwtAuthGuard — used on all protected routes
│   │   └── google-oauth.guard.ts
│   └── strategies/
│       ├── jwt.strategy.ts    # reads token from lx_session cookie
│       └── google.strategy.ts
│
├── users/
│   ├── users.service.ts       # findById, findByEmail, findByGoogleId, create, save
│   ├── users.module.ts        # exports UsersService
│   └── entities/user.entity.ts
│
├── cards/                     # vocabulary card CRUD
│   ├── cards.controller.ts    # GET|POST|PATCH|DELETE /cards, GET /cards/autofill, GET|POST /cards/:id/sentences
│   ├── cards.service.ts       # CRUD operations scoped by userId
│   ├── autofill.service.ts    # single Anthropic call → explanation + example + POS
│   ├── card-sentences.service.ts  # Anthropic call → 2 example sentences; persists to card_sentences
│   ├── cards.module.ts
│   ├── dto/                   # CreateCardDto, UpdateCardDto
│   └── entities/
│       ├── vocab-card.entity.ts
│       └── card-sentence.entity.ts
│
├── phrases/                   # phrase cards ("to lay eyes on") — no practice, no mastery
│   ├── phrases.controller.ts  # all /phrases/* routes
│   ├── phrases.service.ts     # CRUD scoped by userId; AI fill on create (best-effort)
│   ├── phrases-ai.service.ts  # Anthropic calls: explanation + 1 example, or 1 extra example
│   ├── phrases.module.ts
│   ├── dto/                   # CreatePhraseDto, UpdatePhraseDto
│   └── entities/
│       ├── phrase-card.entity.ts
│       └── phrase-sentence.entity.ts
│
├── push/                      # phrase reminders via Web Push (3 a day, 08:00–22:00 user time)
│   ├── push.controller.ts     # GET /push/public-key, POST|DELETE /push/subscriptions
│   ├── push.service.ts        # VAPID setup, subscription upsert/delete, sendToUser (drops 404/410 endpoints)
│   ├── phrase-reminders.service.ts  # @Cron every minute: sends due reminders, schedules the next
│   ├── reminder-schedule.ts   # nextReminderAt() — slot math in the user's IANA time zone (pure, tested)
│   ├── push.module.ts
│   ├── dto/                   # SubscribePushDto, UnsubscribePushDto
│   └── entities/
│       ├── push-subscription.entity.ts
│       └── phrase-reminder.entity.ts
│
└── practice/                  # spaced-repetition practice sessions
    ├── practice.controller.ts    # all /practice/* routes
    ├── practice.service.ts       # scoring logic, mastery sync, @Cron decay job
    ├── practice-ai.service.ts    # Anthropic calls for round generation (batched)
    ├── practice-errors.service.ts # CRUD + AI check for practice_errors
    ├── practice.module.ts
    ├── dto/
    │   ├── practice.dto.ts       # StartRoundDto, StartMode2Dto, ScoreRoundDto, HintMode3Dto, CheckMode3Dto
    │   └── errors.dto.ts         # SaveErrorDto, CheckErrorDto
    └── entities/
        ├── word-progress.entity.ts
        └── practice-error.entity.ts

migrations/                        # manual SQL, NOT applied automatically (schema comes from synchronize)
├── 001_create_word_progress.sql
├── 002_add_mode3_word_progress.sql
└── 003_create_practice_errors.sql

docker-compose.yml                 # dev: postgres (+ optional api container)
docker-compose.prod.yml            # prod: api on `edge` + `internal` networks, postgres internal only
Dockerfile                         # multi-stage, EXPOSE 3010
docker/postgres/init/01-init.sql   # enables uuid-ossp / pgcrypto
deploy/nginx/                      # edge-nginx vhost for lexora-backend.dockore.org
.github/workflows/deploy.yml       # CI deploy on push to release-*
API.md                             # endpoint reference (request/response examples)
DEPLOY.md                          # production deploy guide
```

## Database schema

### `users`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| email | varchar | unique |
| name | varchar | |
| passwordHash | varchar | null for OAuth-only users |
| googleId | varchar | null for email/password users |
| createdAt / updatedAt | timestamp | auto |

### `vocab_cards`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| userId | uuid FK→users | CASCADE delete |
| word | varchar | |
| pos | varchar | default `'noun'` |
| pron | varchar | default `''` |
| explanation | varchar | default `''` |
| example | simple-json (`string[]`) | DTO passes single string (POST/PATCH) → stored as `[string]`; default `[]`. Only fed to AI prompts as the "do not reuse" example — API responses replace it with rows from `card_sentences` |
| mastery | enum | `'learning'` \| `'mastered'`, default `'learning'` |
| streak | int | default 0 |
| addedAt / updatedAt | timestamp | auto |

### `card_sentences`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| cardId | uuid FK→vocab_cards | CASCADE delete |
| userId | uuid FK→users | CASCADE delete |
| sentence | varchar | example sentence (user-supplied or AI-generated) |
| createdAt | timestamp | auto |

`POST /cards` inserts one row from the DTO `example` (if given) — no AI call. AI-generated rows are added only via `POST /cards/:id/sentences` (2 per call). Always returned newest first.

### `phrase_cards`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| userId | uuid FK→users | CASCADE delete |
| phrase | varchar | trimmed, e.g. `to lay eyes on` |
| explanation | varchar | default `''`; AI-generated in English, editable via PATCH |
| addedAt / updatedAt | timestamp | auto |

Phrases are completely separate from `vocab_cards`: no `word_progress`, no mastery, never used by `/practice/*`.

### `phrase_sentences`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| phraseId | uuid FK→phrase_cards | CASCADE delete |
| userId | uuid FK→users | CASCADE delete |
| sentence | varchar | AI-generated example |
| createdAt | timestamp | auto |

### `push_subscriptions`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| userId | uuid FK→users | CASCADE delete |
| endpoint | text | unique; push service URL of one browser/device |
| p256dh / auth | varchar | subscription keys from `PushSubscription.toJSON()` |
| createdAt | timestamp | auto |

Subscribing an endpoint that belongs to another user re-assigns it (shared device, new login).

### `phrase_reminders`
| column | type | notes |
|---|---|---|
| userId | uuid PK, FK→users | CASCADE delete; one schedule per user, shared by all their devices |
| timezone | varchar | IANA zone of the device that subscribed last |
| nextAt | timestamptz | indexed; when the cron sends the next reminder |
| recentPhraseIds | simple-json (`string[]`) | last 2 sent phrases, skipped when picking the next |

Created by the first subscription, deleted when the user's last subscription goes away.

### `word_progress`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| wordId | uuid FK→vocab_cards | CASCADE delete |
| userId | uuid FK→users | CASCADE delete |
| round1_completed | boolean | default false |
| round2_completed | boolean | default false |
| mode2_completed | boolean | default false |
| mode3_completed | boolean | default false |
| total_score | int | 0–4, default 0 |
| last_practiced | timestamp | nullable |
| last_decay_at | timestamp | nullable |
| createdAt / updatedAt | timestamp | auto |

### `practice_errors`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| userId | uuid FK→users | CASCADE delete |
| wordId | uuid FK→vocab_cards | CASCADE delete |
| originalSentence | varchar | sentence the user wrote with grammar errors |
| grammarFeedback | varchar | grammar feedback from AI at time of saving |
| resolvedSentence | varchar | nullable; corrected sentence submitted by user |
| resolvedFeedback | varchar | nullable; AI grammar feedback on the corrected sentence |
| resolved | boolean | default false; set to true by PUT /practice/errors/:id/resolve |
| createdAt / updatedAt | timestamp | auto |

## API

### Auth (`/auth`)

| method | path | auth | description |
|---|---|---|---|
| POST | /auth/register | — | create account, sets lx_session cookie; returns `{id, name, email}` (409 if email taken) |
| POST | /auth/login | — | email+password login, sets lx_session cookie; returns `{id, name, email}` |
| POST | /auth/logout | — | clears lx_session cookie; returns `{ok: true}` |
| GET | /auth/me | JWT | returns `{id, name, email}` |
| GET | /auth/google | — | redirect to Google OAuth |
| GET | /auth/google/callback | — | OAuth callback, sets cookie, redirects to `${FRONTEND_URL}/vocabulary`; on denial → `${FRONTEND_URL}/auth?error=google_denied` |

### Cards (`/cards`) — all require JWT

| method | path | description |
|---|---|---|
| GET | /cards | list all cards (newest first); `example` is `{id, sentence, createdAt}[]` from `card_sentences`; `progress` is `{round1_completed, round2_completed, mode2_completed, mode3_completed, total_score, last_practiced}` from `word_progress`, or `null` if never practiced |
| POST | /cards | create card; DTO `example` string saved to `vocab_cards.example` and as one row in `card_sentences` (no AI call); returns the card in the `GET /cards/:id` shape |
| GET | /cards/:id | get single card; `example` field is `{id, sentence, createdAt}[]` from `card_sentences` (no `progress`) |
| PATCH | /cards/:id | update `word`, `pos`, `pron`, `explanation`, `example`, `mastery`, `streak`; `example` overwrites `vocab_cards.example` only (not `card_sentences`); 400 if no fields; returns the `GET /cards/:id` shape |
| DELETE | /cards/:id | delete card; returns `{ok: true}` |
| GET | /cards/autofill?word= | AI-fill for a word; returns `{explanation, exampleSentence, partOfSpeech}`; saves nothing |
| GET | /cards/:id/sentences | returns `{sentences: {id, sentence, createdAt}[]}` — all saved sentences for the card |
| POST | /cards/:id/sentences | AI-generate 2 new example sentences, save to DB; returns `{sentences}` with only the new rows |

### Phrases (`/phrases`) — all require JWT

A phrase response is `{id, userId, phrase, explanation, addedAt, updatedAt, examples: {id, sentence, createdAt}[]}` (examples newest first). `:id` goes through `ParseUUIDPipe`; a phrase of another user → 404 `Phrase not found`.

| method | path | body | description |
|---|---|---|---|
| GET | /phrases | — | list all phrases (newest first) |
| POST | /phrases | `{phrase}` | create; one AI call fills `explanation` + 1 example. If AI fails (503 from `PhrasesAiService`), the phrase is still saved with `explanation: ''` and `examples: []` |
| GET | /phrases/:id | — | single phrase |
| PATCH | /phrases/:id | `{phrase?, explanation?}` | manual edit; 400 if no fields; returns the phrase |
| DELETE | /phrases/:id | — | delete (examples cascade); returns `{ok: true}` |
| POST | /phrases/:id/generate | — | AI regenerates `explanation` (overwrites) + adds 1 example; for phrases saved while AI was down. 503 on AI failure |
| GET | /phrases/:id/sentences | — | returns `{sentences: {id, sentence, createdAt}[]}` |
| POST | /phrases/:id/sentences | — | AI-generate 1 new example (existing ones passed as "do not reuse"); returns `{sentences}` with only the new row |

### Push (`/push`) — all require JWT

| method | path | body | description |
|---|---|---|---|
| GET | /push/public-key | — | `{publicKey}` (VAPID, base64url) for `pushManager.subscribe`; 503 if VAPID_* is not set |
| POST | /push/subscriptions | `{endpoint, p256dh, auth, timezone}` | upsert this device; starts the reminder schedule if the user has none (or reschedules on a new time zone). 400 `Unsupported push service` unless the endpoint is https on FCM / Mozilla / WNS / Apple push hosts (the server POSTs to it); 400 `Invalid timezone`. Returns `{ok: true}` |
| DELETE | /push/subscriptions | `{endpoint}` | remove this device; the schedule goes with the last one. Returns `{ok: true}` |

### Practice (`/practice`) — all require JWT

| method | path | body | description |
|---|---|---|---|
| POST | /practice/round1 | `{wordIds: string[]}` | AI generates fill-in-the-blank + 4 shuffled options per word |
| PUT | /practice/round1/score | `{wordId, correct}` | record answer; increments score if first correct answer |
| POST | /practice/round2 | `{wordIds: string[]}` | AI generates harder fill-in-the-blank sentences with `expectedWord` |
| PUT | /practice/round2/score | `{wordId, correct}` | same scoring logic as round1/score |
| POST | /practice/mode2 | `{wordId: string}` | AI generates 5 varied sentences for a single word, each with `expectedWord` |
| PUT | /practice/mode2/score | `{wordId, correct}` | same scoring logic; updates `mode2_completed` |
| POST | /practice/mode3/hint | `{wordId}` | AI generates a new unique Ukrainian hint sentence for the word; returns `{hint}` |
| POST | /practice/mode3/check | `{wordId, sentence, hintSentence?}` | AI checks if user's sentence uses the word correctly; optional `hintSentence` adds translation context; returns `{wordUsedCorrectly, explanation, grammarFeedback}` in Ukrainian |
| PUT | /practice/mode3/score | `{wordId, correct}` | same scoring logic; updates `mode3_completed` |
| POST | /practice/errors | `{wordId, originalSentence, grammarFeedback}` | save a sentence with grammar errors for later review |
| GET | /practice/errors | — | list all unresolved errors for the user; includes `word` and `pos` from vocab_cards |
| POST | /practice/errors/:id/check | `{sentence}` | AI checks corrected sentence; saves `resolvedSentence`/`resolvedFeedback` to record; returns `{wordUsedCorrectly, explanation, grammarFeedback}` |
| PUT | /practice/errors/:id/resolve | — | mark error as resolved; returns `{id, resolved, updatedAt}` |

All `*/score` routes return the updated `word_progress` row. All `wordId`/`wordIds` fields are validated as UUID v4; `:id` on `/practice/errors/:id/*` goes through `ParseUUIDPipe`.

## Scoring rules

- `total_score` increments (+1, max 4) only when `correct: true` AND the corresponding completed flag (`round1_completed`, `round2_completed`, `mode2_completed`, `mode3_completed`) was `false`
- Every score call sets `last_practiced = NOW()` and `last_decay_at = null`
- If `total_score >= 4` → `vocab_cards.mastery = 'mastered'`; else `'learning'`

## Decay cron (runs daily at midnight)

**Condition A** — first decay:
- `last_practiced < NOW() - 7 days` AND `last_decay_at IS NULL` AND `total_score > 0`
- Action: `total_score -= 1`, `last_decay_at = NOW()`

**Condition B** — second decay:
- `last_practiced < NOW() - 30 days` AND `last_decay_at IS NOT NULL` AND `last_decay_at < NOW() - 23 days` AND `total_score > 0`
- Action: `total_score -= 1`, `last_decay_at = NOW()`

After either decay: mastery re-synced to `vocab_cards`.

## Phrase reminders cron (runs every minute)

- The 08:00–22:00 window in the user's time zone is split into 3 equal slots (08:00–12:40, 12:40–17:20, 17:20–22:00); each slot gets one reminder at a random moment. A new schedule skips the slot in progress.
- Due reminder (`nextAt <= now`): pick a random phrase of the user (not one of `recentPhraseIds` if possible), send to all their subscriptions, then `nextAt` = random moment in the next slot after the old `nextAt`.
- Payload (quiz, meaning stays in the app): `{title: phrase, body: 'Remember what it means? Tap to check.', url: '/phrases?open=<id>', tag: 'phrase-reminder'}`, TTL 30 min.
- More than 10 min overdue (API was down) → not sent, rescheduled from now. No phrases → nothing sent, schedule kept. No subscriptions left → schedule deleted.

## Auth pattern

All protected controllers use `@UseGuards(JwtAuthGuard)` at the class level. The JWT strategy reads the token from the `lx_session` cookie. The validated payload is `{ id: string }` (user UUID), accessible as `req.user`.

```typescript
@Controller('example')
@UseGuards(JwtAuthGuard)
export class ExampleController {
  @Get()
  doSomething(@Req() req: Request) {
    const { id } = req.user as { id: string };
    // ...
  }
}
```

## AI pattern

`AutofillService`, `PracticeAiService`, `CardSentencesService`, and `PhrasesAiService` follow the same pattern:
- Lazy-instantiate `Anthropic` client from `ANTHROPIC_API_KEY` config
- Single batched request per operation (no per-word calls)
- Wrap `JSON.parse` in try/catch → throw `ServiceUnavailableException`
- Use `claude-sonnet-4-6` model
- Pass a random nonce in the prompt + `temperature: 1` to guarantee unique output on every call
- `AutofillService` and `PhrasesAiService` use structured output (`output_config.format` JSON schema); the others ask for raw JSON in the prompt

## Validation

Global `ValidationPipe` in `main.ts`:
- `whitelist: true` — strips undeclared fields
- `transform: true` — auto-coerces types
- Custom `exceptionFactory` returns `{ message: string }` for all 400s

All DTOs use `class-validator` decorators. All responses on error return `{ message: string }`.
