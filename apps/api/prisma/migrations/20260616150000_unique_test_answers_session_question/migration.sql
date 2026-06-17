-- Ensure one answer row per question inside a test session.
-- If historical duplicates exist, keep the latest answered row when possible.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY session_id, question_id
      ORDER BY answered_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM test_answers
)
DELETE FROM test_answers ta
USING ranked r
WHERE ta.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS test_answers_session_question_idx;

CREATE UNIQUE INDEX test_answers_session_question_unique
  ON test_answers(session_id, question_id);
