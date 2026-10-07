# Grant admission data (проходные баллы на грант)

Powers `/admission/*` (chance calculator, university thresholds, admission goal).

## Source of truth

Every August the Ministry of Science and Higher Education (МНВО РК) publishes the full
**«Список обладателей образовательных грантов»** (bachelor) — every grant holder with ENT score,
program group (ГОП), university code (ОВПО) and quota. We compute the cutoffs from it:

| cycle slug  | ЕНТ / competition | list                                                                                                     |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `2023-2024` | 2023              | testcenter.kz 05.08.2023 (mirror: https://bestnews.kz/docs/2023/08/grantykz.pdf)                         |
| `2024-2025` | 2024              | https://www.gov.kz/uploads/2024/8/3/67ef45247931962752f9bb9b6804e53a_original.25394742.pdf               |
| `2025-2026` | 2025              | https://www.gov.kz/uploads/2025/8/7/fd24dc01bd0ed43a0fa6c66ac007f24c_original.34094741.pdf               |
| `2026-2027` | 2026              | https://drive.google.com/drive/folders/1ofgAYP836otchoHRynfpjE7e4EPetJYz (univision.kz mirror of the MNVO list) |

Reference data — testcenter.kz → «Бакалавриат»:
«Комбинация профпредметов» (ГОП × profile subjects) and «Минимальные баллы ЕНТ для участия в конкурсе»
(official university names/codes).

**Definitions.** For each university × ГОП × quota:
`minScore` = lowest ENT score among grant holders (= проходной балл), `maxScore`, `avgScore`,
`grantCount` = number of grants. `GRANT` merges the open, nationwide full-time competitions at that
university: general competition, Ministry-of-Health order, grants placed directly with the university
(pedagogical / technical groups) and standalone foreign institutions (`DE-537`, `RU-542`, `TR-545`).
`RURAL` = the 35% rural-youth quota of the same competitions. Excluded on purpose: social quotas,
western-region / relocation programs (residence-restricted), short form (college graduates),
out-of-competition grants, joint programs (`KZ-…-045`). A ГОП's cutoff applies to all its
profile-subject variants (grants are awarded per ГОП).

Rural applicants compete in both pools (65% general + 35% rural), so the API shows them
`min(RURAL, GRANT)` — see `src/modules/admission/domain/chance-cutoffs.ts`.

Only aggregates are committed — the lists contain names / ИКТ and must not be stored in the repo.

## Files

- `results/grant-results-YYYY.csv` — aggregates of the official list, all sections, one row per
  section × form × ГОП × tag × university × quota.
- `results/universities-YYYY.csv` — university names as printed in that year's list.
- `programs.csv` — ГОП reference; the n-th row of a code is its `profileVariant` n (variants are kept
  stable — user admission goals reference program ids).
- `universities.csv` — university reference (official name + short name).
- `grant-admission-seed-data.json` — generated, consumed by the seed.

## Refreshing (e.g. after the 2027 competition)

```bash
cd apps/api/prisma/scripts
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install pymupdf openpyxl
# 1. aggregate the new list (checks that every table is numbered 1..N without gaps)
/tmp/venv/bin/python parse_grant_holders_pdf.py <list-2027.pdf> --year 2027 \
  --out ../data/grant-admission/results/grant-results-2027.csv \
  --unis-out ../data/grant-admission/results/universities-2027.csv
# 2. refresh programs.csv / universities.csv from the testcenter.kz spreadsheets
/tmp/venv/bin/python build_admission_reference.py --combinations <Комбинация-профпредметов.xlsx> \
  --min-scores <Минимальные-баллы-ЕНТ-...xlsx>
# 3. add the cycle to CYCLES in prisma/import-grant-csvs.ts, then
cd ../.. && npm run import:grant-admission && npm run seed:grant-admission
```

The public SEO pages (`/prohodnoj-ball-ent/vuz|specialnost/*`, `/ubt-otu-baly/*`) read the seeded data from
`GET /admission/seo-dataset` and pick it up within 6 hours. Also refresh their build-time fallback snapshot
(used only if the API is unreachable during a web build):

```bash
cd ../web && npm run seo:grant-data   # rewrites apps/web/lib/seo/grant-cutoffs.data.json
```

`import:grant-admission` fails loudly on unknown ГОП codes or university codes. The seed replaces each
cycle's cutoffs in one transaction, upserts universities/programs (ids stay stable) and bumps the
Redis `admission-cache-version:<slug>` keys.
