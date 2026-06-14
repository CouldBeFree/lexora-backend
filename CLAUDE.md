# Lexora Backend

NestJS REST API for a vocabulary learning app. TypeScript, TypeORM, PostgreSQL.

## Stack

- **Framework:** NestJS 11
- **ORM:** TypeORM 1.x (`synchronize: true` in dev — no migrations runner needed locally)
- **Database:** PostgreSQL (port 5434 by default, not 5432)
- **Auth:** JWT in `lx_session` httpOnly cookie (30-day expiry), Google OAuth 2.0
- **AI:** `@anthropic-ai/sdk`, model `claude-sonnet-4-6`
- **Cron:** `@nestjs/schedule` with `ScheduleModule.forRoot()` in AppModule

## Environment variables

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5434
POSTGRES_DB=lexora
POSTGRES_USER=lexora
POSTGRES_PASSWORD=lexora_dev_password
JWT_SECRET=...
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
FRONTEND_URL=http://localhost:3000
PORT=3000
```

## Running locally

```bash
docker compose up -d   # starts postgres on port 5434
npm run start:dev      # watch mode
```

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

migrations/
├── 001_create_word_progress.sql   # manual SQL migration for word_progress table
├── 002_add_mode3_word_progress.sql
└── 003_create_practice_errors.sql
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
| example | simple-json (`string[]`) | DTO passes single string → stored as `[string]`; default `[]` |
| mastery | enum | `'learning'` \| `'mastered'`, default `'learning'` |
| streak | int | default 0 |
| addedAt / updatedAt | timestamp | auto |

### `card_sentences`
| column | type | notes |
|---|---|---|
| id | uuid PK | auto |
| cardId | uuid FK→vocab_cards | CASCADE delete |
| userId | uuid FK→users | CASCADE delete |
| sentence | varchar | AI-generated example sentence |
| createdAt | timestamp | auto |

2 rows are inserted automatically on `POST /cards`. Additional rows can be added via `POST /cards/:id/sentences`.

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
| POST | /auth/register | — | create account, sets lx_session cookie |
| POST | /auth/login | — | email+password login, sets lx_session cookie |
| POST | /auth/logout | — | clears lx_session cookie |
| GET | /auth/me | JWT | returns `{id, name, email}` |
| GET | /auth/google | — | redirect to Google OAuth |
| GET | /auth/google/callback | — | OAuth callback, sets cookie, redirects to frontend |

### Cards (`/cards`) — all require JWT

| method | path | description |
|---|---|---|
| GET | /cards | list all cards; `example` field is populated from `card_sentences` as `{id, sentence, createdAt}[]` |
| POST | /cards | create card; DTO `example` string saved to `card_sentences`; AI auto-generates 2 sentences into `card_sentences` |
| GET | /cards/:id | get single card; `example` field is `{id, sentence, createdAt}[]` from `card_sentences` |
| PATCH | /cards/:id | update card fields |
| DELETE | /cards/:id | delete card |
| GET | /cards/autofill?word= | AI-fill explanation, example, POS for a word |
| GET | /cards/:id/sentences | list all saved example sentences for a card |
| POST | /cards/:id/sentences | AI-generate 2 new example sentences and save to DB |

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

`AutofillService`, `PracticeAiService`, and `CardSentencesService` follow the same pattern:
- Lazy-instantiate `Anthropic` client from `ANTHROPIC_API_KEY` config
- Single batched request per operation (no per-word calls)
- Wrap `JSON.parse` in try/catch → throw `ServiceUnavailableException`
- Use `claude-sonnet-4-6` model
- Pass a random nonce in the prompt + `temperature: 1` to guarantee unique output on every call

## Validation

Global `ValidationPipe` in `main.ts`:
- `whitelist: true` — strips undeclared fields
- `transform: true` — auto-coerces types
- Custom `exceptionFactory` returns `{ message: string }` for all 400s

All DTOs use `class-validator` decorators. All responses on error return `{ message: string }`.
