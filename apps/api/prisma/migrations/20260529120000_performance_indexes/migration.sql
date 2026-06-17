-- Hot-path lookup indexes for test generation, scoring, analytics, billing and notifications.
-- All indexes are non-unique so the migration is safe against legacy duplicate data.

-- Catalog and question bank reads
CREATE INDEX IF NOT EXISTS "subjects_exam_type_id_sort_order_idx"
  ON "subjects"("exam_type_id", "sort_order");

CREATE INDEX IF NOT EXISTS "topics_subject_id_sort_order_idx"
  ON "topics"("subject_id", "sort_order");

CREATE INDEX IF NOT EXISTS "questions_subject_active_created_idx"
  ON "questions"("subject_id", "is_active", "created_at");

CREATE INDEX IF NOT EXISTS "questions_exam_active_created_idx"
  ON "questions"("exam_type_id", "is_active", "created_at");

CREATE INDEX IF NOT EXISTS "answer_options_question_sort_idx"
  ON "answer_options"("question_id", "sort_order");

CREATE INDEX IF NOT EXISTS "test_templates_exam_active_idx"
  ON "test_templates"("exam_type_id", "is_active");

CREATE INDEX IF NOT EXISTS "template_sections_template_sort_idx"
  ON "test_template_sections"("template_id", "sort_order");

CREATE INDEX IF NOT EXISTS "template_sections_subject_idx"
  ON "test_template_sections"("subject_id");

-- Test session and answer hot paths
CREATE INDEX IF NOT EXISTS "test_sessions_user_status_finished_idx"
  ON "test_sessions"("user_id", "status", "finished_at");

CREATE INDEX IF NOT EXISTS "test_sessions_exam_status_finished_idx"
  ON "test_sessions"("exam_type_id", "status", "finished_at");

CREATE INDEX IF NOT EXISTS "test_sessions_exam_status_score_idx"
  ON "test_sessions"("exam_type_id", "status", "max_score", "raw_score");

CREATE INDEX IF NOT EXISTS "test_sessions_template_idx"
  ON "test_sessions"("template_id");

CREATE INDEX IF NOT EXISTS "test_answers_session_question_idx"
  ON "test_answers"("session_id", "question_id");

CREATE INDEX IF NOT EXISTS "test_answers_question_session_idx"
  ON "test_answers"("question_id", "session_id");

CREATE INDEX IF NOT EXISTS "funnel_steps_visit_step_session_idx"
  ON "funnel_steps"("visit_id", "step", "session_id");

CREATE INDEX IF NOT EXISTS "funnel_steps_session_timestamp_idx"
  ON "funnel_steps"("session_id", "timestamp");

CREATE INDEX IF NOT EXISTS "visit_events_visitor_path_created_idx"
  ON "visit_events"("visitor_id", "landing_path", "created_at");

-- Subscription/access engine reads
CREATE INDEX IF NOT EXISTS "subscriptions_user_active_window_idx"
  ON "subscriptions"("user_id", "is_active", "starts_at", "expires_at");

CREATE INDEX IF NOT EXISTS "subscriptions_active_expires_idx"
  ON "subscriptions"("is_active", "expires_at");

CREATE INDEX IF NOT EXISTS "entitlements_user_exam_status_window_idx"
  ON "user_exam_entitlements"("user_id", "exam_type_id", "status", "window_starts_at", "window_ends_at");

CREATE INDEX IF NOT EXISTS "entitlements_user_status_window_idx"
  ON "user_exam_entitlements"("user_id", "status", "window_starts_at", "window_ends_at");

CREATE INDEX IF NOT EXISTS "entitlements_subscription_status_idx"
  ON "user_exam_entitlements"("subscription_id", "status");

-- Admission and finance admin reads
CREATE INDEX IF NOT EXISTS "programs_profile_subjects_idx"
  ON "ent_educational_programs"("profile_subjects");

CREATE INDEX IF NOT EXISTS "grant_cutoffs_cycle_quota_idx"
  ON "grant_cutoffs"("cycle_id", "quota_type");

CREATE INDEX IF NOT EXISTS "payment_orders_status_updated_idx"
  ON "payment_orders"("status", "updated_at");

CREATE INDEX IF NOT EXISTS "payment_orders_provider_status_updated_idx"
  ON "payment_orders"("provider", "status", "updated_at");

CREATE INDEX IF NOT EXISTS "payment_orders_status_paid_idx"
  ON "payment_orders"("status", "paid_at");

-- Notification scheduler reads
CREATE INDEX IF NOT EXISTS "notification_deliveries_campaign_attempted_idx"
  ON "notification_deliveries"("campaign_key", "attempted_at");

CREATE INDEX IF NOT EXISTS "notification_deliveries_user_status_sent_idx"
  ON "notification_deliveries"("user_id", "status", "sent_at");

-- Text similarity/search helpers used by admin question and admission search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "questions_content_trgm_idx"
  ON "questions" USING GIN ((content::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "programs_name_trgm_idx"
  ON "ent_educational_programs" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "programs_profile_subjects_trgm_idx"
  ON "ent_educational_programs" USING GIN ("profile_subjects" gin_trgm_ops);
