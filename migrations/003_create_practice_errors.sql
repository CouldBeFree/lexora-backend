-- Migration: create practice_errors table

CREATE TABLE IF NOT EXISTS "practice_errors" (
  "id"               UUID      NOT NULL DEFAULT uuid_generate_v4(),
  "userId"           UUID      NOT NULL,
  "wordId"           UUID      NOT NULL,
  "originalSentence" VARCHAR   NOT NULL,
  "grammarFeedback"  VARCHAR   NOT NULL,
  "resolvedSentence" VARCHAR            DEFAULT NULL,
  "resolvedFeedback" VARCHAR            DEFAULT NULL,
  "resolved"         BOOLEAN   NOT NULL DEFAULT FALSE,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_practice_errors" PRIMARY KEY ("id"),
  CONSTRAINT "fk_practice_errors_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_practice_errors_word"
    FOREIGN KEY ("wordId") REFERENCES "vocab_cards"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_practice_errors_user_unresolved"
  ON "practice_errors" ("userId", "createdAt" DESC)
  WHERE "resolved" = FALSE;
