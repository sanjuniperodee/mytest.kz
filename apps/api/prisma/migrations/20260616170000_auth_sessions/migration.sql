CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "refresh_token_hash" CHAR(64) NOT NULL,
  "user_agent_hash" CHAR(64),
  "ip_hash" CHAR(64),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "last_used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key"
  ON "auth_sessions"("refresh_token_hash");

CREATE INDEX "auth_sessions_user_active_idx"
  ON "auth_sessions"("user_id", "revoked_at", "expires_at");

CREATE INDEX "auth_sessions_family_idx"
  ON "auth_sessions"("family_id");

ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
