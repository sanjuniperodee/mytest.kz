#!/usr/bin/env python3
"""
Parse the official MNVO RK "Список обладателей образовательных грантов на YYYY-YYYY учебный год"
(bachelor, Russian edition) PDF into per (university × program group × quota) aggregates.

Only aggregates are written (min / max / avg score, number of grants) — no names or ИКТ —
so the output is safe to commit.

Usage:
  pip install pymupdf
  python3 parse_grant_holders_pdf.py <list.pdf> --year 2026 \
      --out ../data/grant-admission/results/grant-results-2026.csv \
      --unis-out ../data/grant-admission/results/universities-2026.csv

Where to get the PDFs (published every August by the Ministry of Science and Higher Education):
  2026: https://drive.google.com/drive/folders/1ofgAYP836otchoHRynfpjE7e4EPetJYz (mirror by univision.kz,
        file "_СПИСОК_ОБЛАДАТЕЛЕЙ_ОБРАЗОВАТЕЛЬНЫХ_ГРАНТОВ_НА_2026_2027_УЧЕБНЫЙ.pdf")
  2025: https://drive.google.com/file/d/1h7U5NxT22t51AcWL4dFJDNPt4p5h4eky (linked from informburo.kz;
        original https://www.gov.kz/uploads/2025/8/7/fd24dc01bd0ed43a0fa6c66ac007f24c_original.34094741.pdf)
  2024: https://www.gov.kz/uploads/2024/8/3/67ef45247931962752f9bb9b6804e53a_original.25394742.pdf
        (gov.kz/memleket/entities/sci/documents/details/701261)
  2023: https://bestnews.kz/docs/2023/08/grantykz.pdf (mirror of the testcenter.kz 05.08.2023 publication,
        https://www.testcenter.kz/upload/05082023/Список_обладателей_гранта_2023.pdf)

Document layout (identical in 2025 and 2026):
  * Section title "Список обладателей ... <kind>" followed by "ОЧНАЯ ПОЛНАЯ|СОКРАЩЕННАЯ ФОРМА ОБУЧЕНИЯ".
  * Program header "B057 - Информационные технологии" (or "B044 (UK-535) - ..." for foreign branches,
    "6B01 - Педагогические науки" for the social-quota lists).
  * Optional university header "013 - Евразийский национальный университет ..." (per-university blocks).
  * Column header "№ | ИКТ | Фамилия, Имя, Отчество | Сумма баллов [| ОВПО]".
  * Quota sub-headers "ОБЩИЙ КОНКУРС" / "СЕЛЬСКАЯ КВОТА" (2025+), or a trailing per-row
    "Квота" cell with "сельская" / "ЧС" (2024).
  * Rows: "<n> | <9-digit ИКТ> | <name, may wrap> | <score> [| <3-digit university code>]".
    Social-quota lists use "<n> | <ИКТ> <name> | <score> (<pct> %) | B005 (020)".
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field

import pymupdf  # type: ignore

# Section kinds we recognise from the title text. Order matters (first match wins).
SECTION_RULES: list[tuple[str, str]] = [
    ("по общему конкурсу", "GENERAL"),
    ("Министерства здравоохранения", "HEALTH_MINISTRY"),
    ("по педагогическим группам", "UNIVERSITY_PEDAGOGICAL"),
    ("по техническим и сельскохозяйственным", "UNIVERSITY_TECHNICAL"),
    ("западных регионов", "WESTERN_REGIONS"),
    ("западных и восточных", "WESTERN_REGIONS"),
    ("дифференцированных", "DIFFERENTIATED"),
    ("иностранных граждан", "FOREIGN_CITIZENS"),
    ("вне конкурса", "OUT_OF_COMPETITION"),
    ("из резерва", "RESERVE"),
    ("победителей и призеров", "OUT_OF_COMPETITION"),
    ("сотрудников специальных", "OUT_OF_COMPETITION"),
    ("переселяющихся в регионы", "RURAL_RELOCATION"),
    ("по квоте", "SOCIAL_QUOTA"),
    ("тюркоязычных", "TURKIC_STUDENTS"),
    ("филиал", "FOREIGN_BRANCH"),
    ("Иностранн", "FOREIGN_BRANCH"),
    ("двудипломным", "DOUBLE_DEGREE"),
    ("двойного диплома", "DOUBLE_DEGREE"),
    ("Стратегического партнерства", "STRATEGIC_PARTNERSHIP"),
]

PROGRAM_RE = re.compile(r"^(BM?\d{3})(?:\s*\(([A-Z]{2}(?:-[A-Z]{2,3})*-)?(\d{3})\))?\s*-\s*(.+)$")
FIELD_RE = re.compile(r"^6B\d{2}\s*-\s*.+$")
OTHER_PROGRAM_RE = re.compile(r"^\d{2}\.\d{2}\.\d{2}\s*-\s*.+$")  # Russian-standard codes (MAI Voskhod)
UNI_RE = re.compile(r"^(\d{3})\s*-\s*(.+)$")
IKT_RE = re.compile(r"^(\d{9})(?:\s+(.*))?$")
# Rows >= 1000 in the 2024 edition come out as one line: "<n> <ИКТ> <name>".
ROW_MERGED_RE = re.compile(r"^(\d{1,5})\s+(\d{9})(?:\s+(.*))?$")
SCORE_RE = re.compile(r"^(\d{1,3})(?:\s*\(\s*\d+(?:,\d+)?\s*%\s*\))?$")
PCT_ONLY_RE = re.compile(r"^\d+(?:,\d+)?\s*%$")
GROUP_UNI_RE = re.compile(r"^(BM?\d{3})\s*\(((?:[A-Z]{2}(?:-[A-Z]{2,3})*-)?)(\d{3})\)$")
QUOTA_HEADERS = {"ОБЩИЙ КОНКУРС": "GENERAL", "СЕЛЬСКАЯ КВОТА": "RURAL"}
# 2024 edition: quota is a per-row trailing column (empty = general competition).
ROW_QUOTA_CELLS = {"сельская": "RURAL", "ЧС": "EMERGENCY_REGIONS"}


@dataclass
class State:
    section: str = "UNKNOWN"
    form: str = "FULL"
    program_code: str | None = None
    program_name: str | None = None
    program_uni: int | None = None  # university fixed by the program header, e.g. "B044 (UK-535)"
    program_tag: str = ""  # "UK-535", "KZ-US-045", ... ("" for regular programs)
    block_uni: int | None = None  # university fixed by a "013 - ..." block header
    quota: str = "GENERAL"
    has_uni_col: bool = False
    has_group_uni_col: bool = False
    prev_no: int = 0  # last row number seen in the current table (sanity check)


@dataclass
class Agg:
    scores: list[int] = field(default_factory=list)
    program_name: str = ""


CYR_CODE_RE = re.compile(r"^[BВ][MМ]?\d{3}\b")


def normalize_code_prefix(line: str) -> str:
    """2023 sometimes types program codes with Cyrillic В/М ("В057")."""
    if CYR_CODE_RE.match(line):
        head = line[:2].replace("В", "B").replace("М", "M")
        return head + line[2:]
    return line


def page_lines(doc) -> list[str]:
    out: list[str] = []
    for i, page in enumerate(doc):
        lines = [l.strip() for l in page.get_text().split("\n")]
        lines = [normalize_code_prefix(l) for l in lines if l]
        # first line is the page number
        if lines and lines[0] == str(i + 1):
            lines = lines[1:]
        out.extend(lines)
    return out


def classify_section(title: str) -> str:
    for needle, kind in SECTION_RULES:
        if needle.lower() in title.lower():
            return kind
    return "UNKNOWN"


def parse(path: str):
    doc = pymupdf.open(path)
    lines = page_lines(doc)
    st = State()
    aggs: dict[tuple, Agg] = defaultdict(Agg)
    uni_names: dict[int, str] = {}
    stats = defaultdict(int)
    unhandled: dict[str, int] = defaultdict(int)
    # table_id -> [rows parsed, max row number, section]; every table is numbered 1..N
    tables: dict[int, list] = defaultdict(lambda: [0, 0, ""])
    table_id = 0

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]

        # Document title ("СПИСОК ОБЛАДАТЕЛЕЙ ... НА 2026-2027 УЧЕБНЫЙ ГОД"), possibly wrapped.
        if line.startswith("СПИСОК ОБЛАДАТЕЛЕЙ") and re.search(r"НА\s+\d{4}-\d{4}|УЧЕБНЫЙ ГОД", line):
            i += 1
            continue
        if line == "УЧЕБНЫЙ ГОД":
            i += 1
            continue

        # Section title; 2023 spells the first one in upper case.
        if line.startswith("Список обладателей") or line.startswith("СПИСОК ОБЛАДАТЕЛЕЙ"):
            title = [line]
            j = i + 1
            while j < n and not (
                "ФОРМА ОБУЧЕНИЯ" in lines[j]
                or PROGRAM_RE.match(lines[j])
                or FIELD_RE.match(lines[j])
                or lines[j] == "№"
            ):
                title.append(lines[j])
                j += 1
            st = State(section=classify_section(" ".join(title)))
            i = j
            continue

        if "ФОРМА ОБУЧЕНИЯ" in line:
            st.form = "SHORT" if "СОКРАЩ" in line else "FULL"
            i += 1
            continue

        m = PROGRAM_RE.match(line)
        if m:
            st.program_code = m.group(1)
            name = m.group(4)
            # drop the repeated "(UK-535)" suffix, including a half of it cut by a line wrap ("(KZ-")
            name = re.sub(r"\s*\((?:[A-Z]{2}(?:-[A-Z]{0,3})*)?\d{0,3}\)?\s*$", "", name).strip()
            st.program_name = name
            st.program_uni = int(m.group(3)) if m.group(3) else None
            st.program_tag = f"{m.group(2) or ''}{m.group(3)}" if m.group(3) else ""
            st.block_uni = None
            st.quota = "GENERAL"
            i += 1
            continue

        if FIELD_RE.match(line) or OTHER_PROGRAM_RE.match(line):
            st.program_code = None if OTHER_PROGRAM_RE.match(line) else st.program_code
            st.program_name = None
            st.program_uni = None
            st.program_tag = ""
            st.block_uni = None
            st.quota = "GENERAL"
            if OTHER_PROGRAM_RE.match(line):
                st.program_code = "SKIP"
            i += 1
            continue

        um = UNI_RE.match(line)
        if um and not line.startswith("№"):
            code = int(um.group(1))
            name = um.group(2).strip()
            # university names can wrap onto the next line(s) until the table header "№"
            j = i + 1
            while (
                j < n
                and lines[j] != "№"
                and not lines[j].startswith("Проходные параметры")
                and not UNI_RE.match(lines[j])
                and not PROGRAM_RE.match(lines[j])
            ):
                name += " " + lines[j]
                j += 1
            uni_names.setdefault(code, re.sub(r"\s+", " ", name).strip())
            st.block_uni = code
            st.quota = "GENERAL"
            i = j
            continue

        if line == "№":
            table_id += 1
            # column header; detect which trailing columns exist
            j = i + 1
            header = []
            while j < n and len(header) < 12 and not re.fullmatch(r"\d+", lines[j]) and lines[j] not in QUOTA_HEADERS:
                header.append(lines[j])
                j += 1
            htxt = " ".join(header)
            st.has_group_uni_col = "Группа образовательных программ" in htxt
            st.has_uni_col = (not st.has_group_uni_col) and ("ОВПО" in htxt or "ВУЗ" in header)
            i = j
            continue

        if line in QUOTA_HEADERS:
            st.quota = QUOTA_HEADERS[line]
            i += 1
            continue

        # Row: "<n>" then "<ikt>[ name]"
        merged = ROW_MERGED_RE.match(line)
        if (re.fullmatch(r"\d{1,5}", line) and i + 1 < n and IKT_RE.match(lines[i + 1])) or merged:
            row_no = int(merged.group(1)) if merged else int(line)
            if row_no != st.prev_no + 1 and row_no != 1:
                stats[f"row_number_gap:{st.section}"] += 1
            st.prev_no = row_no
            tbl = tables[table_id]
            tbl[0] += 1
            tbl[1] = max(tbl[1], row_no)
            tbl[2] = st.section
            j = i + 1 if merged else i + 2
            # name lines until the score
            while j < n and not (SCORE_RE.match(lines[j]) or PCT_ONLY_RE.match(lines[j])):
                j += 1
                if j - i > 8:
                    break
            if j >= n or j - i > 8:
                stats["row_parse_fail"] += 1
                i += 1
                continue
            score_line = lines[j]
            j += 1
            uni: int | None = None
            code = st.program_code
            tag = st.program_tag
            if st.has_uni_col:
                if j < n and re.fullmatch(r"\d{3}", lines[j]):
                    uni = int(lines[j])
                    j += 1
                else:
                    stats["missing_uni_col"] += 1
            elif st.has_group_uni_col:
                gm = GROUP_UNI_RE.match(lines[j]) if j < n else None
                if gm:
                    code = gm.group(1)
                    uni = int(gm.group(3))
                    tag = f"{gm.group(2)}{gm.group(3)}" if gm.group(2) else ""
                    j += 1
                else:
                    stats["missing_group_uni_col"] += 1
            if uni is None:
                uni = st.block_uni if st.block_uni is not None else st.program_uni
            row_quota = st.quota
            if j < n and lines[j] in ROW_QUOTA_CELLS:
                row_quota = ROW_QUOTA_CELLS[lines[j]]
                j += 1
            if PCT_ONLY_RE.match(score_line):
                stats["pct_only_rows"] += 1  # ranked by percentage, no ENT score
                i = j
                continue
            score = int(SCORE_RE.match(score_line).group(1))
            if code in (None, "SKIP") or uni is None:
                stats["row_without_program_or_uni"] += 1
                i = j
                continue
            key = (st.section, st.form, code, tag, uni, row_quota)
            agg = aggs[key]
            agg.scores.append(score)
            if st.program_name:
                agg.program_name = st.program_name
            stats["rows"] += 1
            i = j
            continue

        stats["unhandled_lines"] += 1
        unhandled[line] += 1
        i += 1

    for count, max_no, section in tables.values():
        if count != max_no:
            stats[f"rows_missing:{section}"] += max_no - count
    return aggs, uni_names, stats, unhandled


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", required=True, type=int)
    ap.add_argument("--out", required=True)
    ap.add_argument("--unis-out")
    ap.add_argument("--debug", action="store_true", help="print the most common unparsed lines")
    args = ap.parse_args()

    aggs, uni_names, stats, unhandled = parse(args.pdf)
    if args.debug:
        for line, cnt in sorted(unhandled.items(), key=lambda kv: -kv[1])[:80]:
            print(f"  unhandled x{cnt}: {line!r}", file=sys.stderr)

    rows = []
    for (section, form, code, tag, uni, quota), agg in aggs.items():
        s = agg.scores
        rows.append(
            {
                "year": args.year,
                "section": section,
                "form": form,
                "programCode": code,
                "programTag": tag,
                "programName": agg.program_name,
                "universityCode": uni,
                "quota": quota,
                "minScore": min(s),
                "maxScore": max(s),
                "avgScore": round(sum(s) / len(s), 1),
                "grantCount": len(s),
            }
        )
    rows.sort(
        key=lambda r: (r["section"], r["form"], r["programCode"], r["programTag"], r["universityCode"], r["quota"])
    )
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    if args.unis_out:
        with open(args.unis_out, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["code", "name"])
            for code in sorted(uni_names):
                w.writerow([code, uni_names[code]])

    print(f"{args.pdf}: {len(rows)} aggregates, stats={dict(stats)}", file=sys.stderr)
    by_section = defaultdict(int)
    for r in rows:
        by_section[(r["section"], r["form"])] += r["grantCount"]
    for k, v in sorted(by_section.items()):
        print(f"  {k}: {v} grants", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
