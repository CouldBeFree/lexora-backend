-- Migration: add mode3_completed to word_progress, extend total_score constraint to 0-4

ALTER TABLE "word_progress"
  ADD COLUMN IF NOT EXISTS "mode3_completed" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "word_progress"
  DROP CONSTRAINT IF EXISTS "chk_total_score";

ALTER TABLE "word_progress"
  ADD CONSTRAINT "chk_total_score" CHECK ("total_score" BETWEEN 0 AND 4);
