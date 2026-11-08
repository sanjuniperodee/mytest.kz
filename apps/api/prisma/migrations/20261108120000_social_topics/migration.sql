-- Обсуждения по темам (вуз, специальность, вопрос дня) и публичные вопросы с SEO-страниц.
-- Только добавляет колонки с безопасными значениями по умолчанию: существующие посты остаются закрытыми.
ALTER TABLE "SocialPost" ADD COLUMN "topicKey" VARCHAR(64);
ALTER TABLE "SocialPost" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "SocialPost_topicKey_isPublic_createdAt_idx" ON "SocialPost"("topicKey", "isPublic", "createdAt");
