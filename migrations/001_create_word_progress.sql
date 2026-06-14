-- Migration: create word_progress table

CREATE TABLE IF NOT EXISTS "word_progress" (
  "id"               UUID         NOT NULL DEFAULT uuid_generate_v4(),
  "wordId"           UUID         NOT NULL,
  "userId"           UUID         NOT NULL,
  "round1_completed" BOOLEAN      NOT NULL DEFAULT FALSE,
  "round2_completed" BOOLEAN      NOT NULL DEFAULT FALSE,
  "mode2_completed"  BOOLEAN      NOT NULL DEFAULT FALSE,
  "total_score"      INTEGER      NOT NULL DEFAULT 0
                                            CONSTRAINT chk_total_score CHECK ("total_score" BETWEEN 0 AND 3),
  "last_practiced"   TIMESTAMP            DEFAULT NULL,
  "last_decay_at"    TIMESTAMP            DEFAULT NULL,
  "createdAt"        TIMESTAMP    NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_word_progress" PRIMARY KEY ("id"),
  CONSTRAINT "fk_word_progress_word"
    FOREIGN KEY ("wordId") REFERENCES "vocab_cards"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_word_progress_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_word_progress_user_word"
  ON "word_progress" ("userId", "wordId");

CREATE INDEX IF NOT EXISTS "idx_word_progress_last_practiced"
  ON "word_progress" ("last_practiced")
  WHERE "total_score" > 0;
