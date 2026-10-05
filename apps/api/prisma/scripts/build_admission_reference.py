#!/usr/bin/env python3
"""
Refresh the admission reference CSVs (programs.csv, universities.csv) from the official
National Testing Center (НЦТ, testcenter.kz → «Бакалавриат») spreadsheets.

Usage:
  pip install openpyxl
  python3 build_admission_reference.py \
      --combinations Комбинация-профпредметов-2026-03.07.2026.xlsx \
      --min-scores Минимальные-баллы-ЕНТ-для-участия-в-Конкурсе-...-2026-года.xlsx \
      [--results-dir ../data/grant-admission/results]

Sources (2026 edition):
  https://testcenter.kz/wp-content/uploads/2026/07/Комбинация-профпредметов-2026-03.07.2026.xlsx
  https://testcenter.kz/wp-content/uploads/2026/07/Минимальные-баллы-ЕНТ-для-участия-в-Конкурсе-по-присуждению-образовательных-грантов-2026-года.xlsx

programs.csv
  * one row per (program group code, profile-subject combination); the n-th row of a code is
    its `profileVariant` n. Variants are kept STABLE: an existing variant keeps its index (and so its
    DB id, which user admission goals reference) — only its name / subjects are refreshed. New
    combinations are appended as new variants. Codes missing from the official file are kept as is.
universities.csv
  * official names from the min-scores file (latest), short names are kept from the existing file.
  * codes that only occur in the parsed results get names from the results' university headers
    (--results-dir/universities-*.csv, written by parse_grant_holders_pdf.py --unis-out) or MANUAL_UNIVERSITIES.
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
from collections import defaultdict

import openpyxl  # type: ignore

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "grant-admission")
PROGRAMS_CSV = os.path.join(DATA_DIR, "programs.csv")
UNIVERSITIES_CSV = os.path.join(DATA_DIR, "universities.csv")

SUBJECT_SHORT = {
    "Математика": "Мат",
    "Физика": "Физ",
    "Информатика": "Инфо",
    "Биология": "Био",
    "Химия": "Хим",
    "География": "Гео",
    "Всемирная история": "ДЖТ",
    "Основы права": "Құқық",
    "Английский язык": "Англ",
    "Немецкий язык": "Нем",
    "Французский язык": "Фр",
    "Казахский язык": "Каз Т",
    "Казахская литература": "Каз А",
    "Русский язык": "Рус Яз",
    "Русская литература": "Рус Лит",
    "Творческий экзамен": "Творческий",
}

# Universities renamed since the short names were written (code -> new short name).
SHORT_NAME_OVERRIDES = {
    19: "ALT University",
    42: "Шәкәрім Univ",
    89: "Q University",
    160: "META University",
    527: "КазНУС",
}

# Codes that appear in the grant results but not in the min-scores file / results headers.
MANUAL_UNIVERSITIES = {
    111: ("Национальный исследовательский университет искусственного интеллекта", "NAIRU (QAIRU)"),
    529: ("Казахский национальный университет водного хозяйства и ирригации", "КазНУВХИ"),
    537: ("Филиал «Международный Университет Анхальт в Казахстане» Университета прикладных наук Анхальт", "Anhalt (филиал)"),
    542: ("Филиал МГИМО (университет) МИД Российской Федерации в городе Астана", "МГИМО (филиал)"),
    543: ("Университет Ұлытау", "Ұлытау"),
    545: ("Филиал университета Гази в городе Шымкенте", "Gazi (филиал)"),
    546: ("Иностранное учебное заведение «University of Innovation and Technology»", "UIT"),
}


def clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def subjects_key(subjects: str) -> tuple[str, ...]:
    parts = [p.strip() for p in re.split(r"\s*-\s*", subjects) if p.strip()]
    return tuple(sorted(set(parts)))


def short_label(subjects: str) -> str:
    parts = [p.strip() for p in re.split(r"\s*-\s*", subjects) if p.strip()]
    if parts and all(p == "Творческий экзамен" for p in parts):
        return "Творческий"
    return "-".join(SUBJECT_SHORT.get(p, p[:4]) for p in parts)


def read_existing_programs() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    started = False
    with open(PROGRAMS_CSV, encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            c0 = clean(row[0] if row else "")
            if not started:
                started = "КОД" in c0
                continue
            code = c0.replace(" ", "").upper()
            if not re.fullmatch(r"BM?\d+", code) or len(row) < 3 or not clean(row[1]):
                continue
            out[code].append(
                {"name": clean(row[1]), "subjects": clean(row[2]), "short": clean(row[3] if len(row) > 3 else "")}
            )
    return out


def read_official_combinations(path: str) -> dict[str, list[dict]]:
    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    header = [clean(h) for h in rows[0]]
    i_code = header.index("Код ГОП")
    i_name = header.index("ГОП на русском")
    i_subj = header.index("Комбинация профильных предметов на русском")
    out: dict[str, list[dict]] = defaultdict(list)
    for r in rows[1:]:
        code = clean(r[i_code])
        # skip joint / foreign-branch variants like "B018 (KZ-FR-007)"
        if not re.fullmatch(r"BM?\d{3}", code):
            continue
        subjects = clean(r[i_subj])
        if any(subjects_key(x["subjects"]) == subjects_key(subjects) for x in out[code]):
            continue
        out[code].append({"name": clean(r[i_name]), "subjects": subjects, "short": short_label(subjects)})
    return out


def merge_programs(existing: dict[str, list[dict]], official: dict[str, list[dict]]) -> dict[str, list[dict]]:
    merged: dict[str, list[dict]] = {}
    for code in sorted(set(existing) | set(official), key=lambda c: (int(re.sub(r"\D", "", c)), c)):
        ex = existing.get(code, [])
        of = official.get(code, [])
        if not of:
            merged[code] = ex
            continue
        result: list[dict | None] = [None] * len(ex)
        unused = list(of)
        # 1) same subject combination keeps its variant index
        for idx, e in enumerate(ex):
            match = next((o for o in unused if subjects_key(o["subjects"]) == subjects_key(e["subjects"])), None)
            if match:
                result[idx] = match
                unused.remove(match)
        # 2) remaining existing variants take the remaining official combinations in order
        for idx, e in enumerate(ex):
            if result[idx] is None:
                result[idx] = unused.pop(0) if unused else e
        # 3) new combinations become new variants
        merged[code] = [r for r in result if r is not None] + unused
    # Codes absent from the official file keep their rows, but their subject strings are brought to
    # the official spelling ("Биология-Химия" -> "Биология - Химия") so the UI groups them together.
    canonical = {subjects_key(o["subjects"]): o["subjects"] for combos in official.values() for o in combos}
    for variants in merged.values():
        for v in variants:
            official_spelling = canonical.get(subjects_key(v["subjects"]))
            if official_spelling and official_spelling != v["subjects"]:
                v["subjects"] = official_spelling
                v["short"] = short_label(official_spelling)
    return merged


def write_programs(programs: dict[str, list[dict]]) -> None:
    with open(PROGRAMS_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["КОД", "Название образовательной программы", "Профильные Предметы ЕНТ", "Краткое Название Предметов"])
        for code, variants in programs.items():
            for v in variants:
                w.writerow([code, v["name"], v["subjects"], v["short"]])


def read_existing_universities() -> dict[int, dict]:
    out: dict[int, dict] = {}
    with open(UNIVERSITIES_CSV, encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if len(row) > 2 and clean(row[1]).isdigit() and clean(row[2]):
                out[int(row[1])] = {"name": clean(row[2]), "short": clean(row[3] if len(row) > 3 else "")}
    return out


def read_official_universities(path: str) -> dict[int, str]:
    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    out: dict[int, str] = {}
    header_idx = None
    for r in ws.iter_rows(values_only=True):
        cells = [clean(c) for c in r]
        if header_idx is None:
            if "Код ОВПО" in cells:
                header_idx = (cells.index("Код ОВПО"), cells.index("Наименование ОВПО"))
            continue
        code, name = r[header_idx[0]], clean(r[header_idx[1]])
        if isinstance(code, (int, float)) and name:
            out[int(code)] = name
    return out


def read_results_university_names(results_dir: str | None) -> dict[int, str]:
    out: dict[int, str] = {}
    if not results_dir:
        return out
    # older years first so that the latest name wins
    for path in sorted(glob.glob(os.path.join(results_dir, "universities-*.csv"))):
        with open(path, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                out[int(r["code"])] = clean(r["name"])
    return out


def read_results_university_codes(results_dir: str | None) -> set[int]:
    codes: set[int] = set()
    if not results_dir:
        return codes
    for path in glob.glob(os.path.join(results_dir, "grant-results-*.csv")):
        with open(path, encoding="utf-8") as f:
            codes |= {int(r["universityCode"]) for r in csv.DictReader(f)}
    return codes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--combinations", required=True)
    ap.add_argument("--min-scores", required=True)
    ap.add_argument("--results-dir", default=os.path.join(DATA_DIR, "results"))
    args = ap.parse_args()

    programs = merge_programs(read_existing_programs(), read_official_combinations(args.combinations))
    write_programs(programs)
    print(f"programs.csv: {sum(len(v) for v in programs.values())} rows, {len(programs)} codes")

    existing = read_existing_universities()
    official = read_official_universities(args.min_scores)
    from_results = read_results_university_names(args.results_dir)
    used_codes = read_results_university_codes(args.results_dir)

    unis: dict[int, dict] = {}
    for code in sorted(set(existing) | set(official) | used_codes):
        name = official.get(code) or from_results.get(code)
        short = SHORT_NAME_OVERRIDES.get(code) or existing.get(code, {}).get("short", "")
        if code in MANUAL_UNIVERSITIES:
            m_name, m_short = MANUAL_UNIVERSITIES[code]
            name = name or m_name
            short = short or m_short
        name = name or existing.get(code, {}).get("name")
        if not name:
            print(f"WARNING: no name for university {code}")
            continue
        unis[code] = {"name": name, "short": short}

    with open(UNIVERSITIES_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["", "КОД Университета", "Наименование Университета", "Краткое название университета"])
        for code, u in unis.items():
            w.writerow(["", code, u["name"], u["short"]])
    print(f"universities.csv: {len(unis)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
