-- Grant admission: admission year per cycle + per-cutoff statistics computed from the official
-- MNVO grant-holder lists (max / average score and number of grants awarded).
-- Additive: nullable columns only, no existing data is touched.

-- AlterTable
ALTER TABLE "grant_admission_cycles" ADD COLUMN "admission_year" INTEGER;

-- AlterTable
ALTER TABLE "grant_cutoffs" ADD COLUMN "max_score" INTEGER,
ADD COLUMN "avg_score" DOUBLE PRECISION,
ADD COLUMN "grant_count" INTEGER;
