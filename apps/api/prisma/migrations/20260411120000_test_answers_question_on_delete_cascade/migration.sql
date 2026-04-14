-- Allow deleting questions (e.g. re-seed) without orphan test_answers blocking the FK.
ALTER TABLE "test_answers" DROP CONSTRAINT "test_answers_question_id_fkey";
ALTER TABLE "test_answers"
  ADD CONSTRAINT "test_answers_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
