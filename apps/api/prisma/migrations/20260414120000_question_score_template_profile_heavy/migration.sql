-- Question: explicit score weight for ENT (1 or 2; null = use template section rule)
ALTER TABLE "questions" ADD COLUMN "score_weight" SMALLINT;

-- Template section: profile block — from which 1-based index questions count as 2 points (default 31 in app if null)
ALTER TABLE "test_template_sections" ADD COLUMN "profile_heavy_from" SMALLINT;
