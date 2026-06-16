-- Drop indexes that are fully covered by another composite/unique index.
-- Postgres serves the shorter lookup from the leading columns of the wider index,
-- so these add write amplification + storage with zero read benefit.
-- Each DROP names the covering index it is redundant against.
-- IF EXISTS keeps the migration idempotent and safe to re-run.

-- (subject_id, is_active)  ⊂  questions_subject_active_created_idx (subject_id, is_active, created_at)
DROP INDEX IF EXISTS "questions_subject_id_is_active_idx";

-- (exam_type_id, is_active)  ⊂  questions_exam_active_created_idx (exam_type_id, is_active, created_at)
DROP INDEX IF EXISTS "questions_exam_type_id_is_active_idx";

-- (user_id, exam_type_id, status)  ⊂  entitlements_user_exam_status_window_idx (… , window_starts_at, window_ends_at)
DROP INDEX IF EXISTS "user_exam_entitlements_user_exam_status_idx";

-- (user_id, status)  ⊂  test_sessions_user_status_finished_idx (user_id, status, finished_at)
DROP INDEX IF EXISTS "test_sessions_user_id_status_idx";

-- (session_id)  ⊂  test_answers_session_question_idx (session_id, question_id)
DROP INDEX IF EXISTS "test_answers_session_id_idx";

-- (cycle_id, university_code)  ⊂  grant_cutoffs unique (cycle_id, university_code, program_id, quota_type)
DROP INDEX IF EXISTS "grant_cutoffs_cycle_id_university_code_idx";

-- (visit_id)  ⊂  funnel_steps_visit_step_session_idx (visit_id, step, session_id)
DROP INDEX IF EXISTS "funnel_steps_visit_id_idx";
