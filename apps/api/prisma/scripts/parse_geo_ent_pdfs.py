#!/usr/bin/env python3
"""Parse ENT geography KK/RU PDFs into geo-ent-seed-data.json.

Usage:
  python3 prisma/scripts/parse_geo_ent_pdfs.py
  python3 prisma/scripts/parse_geo_ent_pdfs.py --kk-pdf "/abs/path/kk.pdf" --ru-pdf "/abs/path/ru.pdf"
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from pypdf import PdfReader

THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parents[4]
OUT = THIS_FILE.parent.parent / "geo-ent-seed-data.json"

DEFAULT_KK_PDF = REPO_ROOT / "geo-tsts" / "гео каз 5 нуска толык емес 175сурак (1).pdf"
DEFAULT_RU_PDF = REPO_ROOT / "geo-tsts" / "гео русс 5вариантов 175вопросов не полный (1).pdf"

CYR_A = "\u0410"  # А
CYR_V = "\u0412"  # В
CYR_ES = "\u0421"  # С


def norm(s: str) -> str:
    s = s.replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def letter_to_latin(ch: str) -> str | None:
    if not ch:
        return None
    c = ch.strip()[0]
    table = {
        "A": "A",
        "B": "B",
        "C": "C",
        "D": "D",
        "E": "E",
        "F": "F",
        CYR_A: "A",
        CYR_V: "B",
        CYR_ES: "C",
    }
    return table.get(c.upper())


def extract_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    parts: list[str] = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        parts.append(txt)
    return "\n".join(parts)


def normalize_for_parsing(raw: str) -> str:
    text = raw.replace("\r", "\n")
    text = re.sub(r"--\s*\d+\s+of\s+\d+\s*--", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b\d+\s+(?:НҰСҚА|ВАРИАНТ)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", " ", text)
    # Нормализуем "2 Тема:" -> "2) Тема:" для стабильного деления блоков.
    text = re.sub(r"(?<!\d)(\d{1,3})\s+(Тема\s*:)", r"\1) \2", text, flags=re.IGNORECASE)
    # Разделяем вопросы.
    text = re.sub(
        r"(?<!\d)(\d{1,3}\)\s*(?:Тақырыбы|Тема)\s*:)",
        r"\n\1",
        text,
        flags=re.IGNORECASE,
    )
    return text.strip()


def split_question_blocks(normalized_text: str) -> list[str]:
    blocks = [norm(x) for x in normalized_text.split("\n")]
    out: list[str] = []
    for b in blocks:
        if not b:
            continue
        if re.match(r"^\d{1,3}\)\s*(?:Тақырыбы|Тема)\s*:", b, re.IGNORECASE):
            out.append(b)
    return out


def parse_question_block(block: str, locale: str) -> dict[str, Any] | None:
    header = re.match(r"^(\d{1,3})\)\s*(?:Тақырыбы|Тема)\s*:\s*(.+)$", block, re.IGNORECASE)
    if not header:
        return None
    n = int(header.group(1))
    tail = header.group(2)

    ans_m = re.search(r"(?:Жауабы|Жауап|Ответ)\s*:\s*(.+)$", tail, re.IGNORECASE)
    if not ans_m:
        return None
    answer_text = norm(ans_m.group(1))
    before_answer = norm(tail[: ans_m.start()])

    opt_re = re.compile(
        rf"([A-F{CYR_A}{CYR_V}{CYR_ES}])\)\s*(.*?)\s*(?=(?:[A-F{CYR_A}{CYR_V}{CYR_ES}]\)\s*)|$)",
        re.IGNORECASE | re.DOTALL,
    )
    options_found = list(opt_re.finditer(before_answer))
    if len(options_found) < 2:
        return None

    first = options_found[0]
    topic_and_stem = norm(before_answer[: first.start()])
    if not topic_and_stem:
        return None

    # В PDF отдельной строки вопроса нет, поэтому в stem сохраняем "topic + prompt".
    stem = topic_and_stem
    topic = "Жалпы" if locale == "kk" else "Общее"

    options: dict[str, str] = {}
    for m in options_found:
        key = letter_to_latin(m.group(1))
        if not key:
            continue
        options[key] = norm(m.group(2))
    if len(options) < 2:
        return None

    letters = re.findall(rf"([A-F{CYR_A}{CYR_V}{CYR_ES}])\)", answer_text, flags=re.IGNORECASE)
    correct: list[str] = []
    for raw in letters:
        key = letter_to_latin(raw)
        if key and key in options and key not in correct:
            correct.append(key)
    if not correct:
        single = re.search(rf"^([A-F{CYR_A}{CYR_V}{CYR_ES}])\b", answer_text, flags=re.IGNORECASE)
        if single:
            key = letter_to_latin(single.group(1))
            if key and key in options:
                correct.append(key)
    if not correct:
        return None

    return {
        "n": n,
        "topic": topic,
        "stem": stem,
        "options": options,
        "correct": correct,
        "contentLocale": locale,
    }


def build_bank(bank_id: str, label: dict[str, str], pdf_path: Path, locale: str) -> dict[str, Any]:
    text = extract_pdf_text(pdf_path)
    normalized = normalize_for_parsing(text)
    blocks = split_question_blocks(normalized)

    parsed: list[dict[str, Any]] = []
    for block in blocks:
        q = parse_question_block(block, locale)
        if q:
            parsed.append(q)

    dedup: dict[tuple[Any, ...], dict[str, Any]] = {}
    for q in parsed:
        fp = (
            q["n"],
            norm(q["stem"]),
            tuple(sorted((k, norm(v)) for k, v in q["options"].items())),
            tuple(q["correct"]),
        )
        dedup[fp] = q

    topics: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for q in sorted(dedup.values(), key=lambda x: x["n"]):
        topics[q["topic"]].append(q)

    topics_out = [
        {"name": {"kk": t, "ru": t, "en": t}, "questions": qs}
        for t, qs in sorted(topics.items(), key=lambda kv: kv[0].lower())
    ]

    return {
        "id": bank_id,
        "label": label,
        "topics": topics_out,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kk-pdf", type=Path, default=DEFAULT_KK_PDF)
    parser.add_argument("--ru-pdf", type=Path, default=DEFAULT_RU_PDF)
    args = parser.parse_args()

    kk_pdf = args.kk_pdf
    ru_pdf = args.ru_pdf
    if not kk_pdf.exists():
        raise SystemExit(f"Missing KK PDF: {kk_pdf}")
    if not ru_pdf.exists():
        raise SystemExit(f"Missing RU PDF: {ru_pdf}")

    banks = [
        build_bank(
            "ent-geo-kk-5x175-incomplete",
            {
                "kk": "ЕНТ · География · 5 нұсқа (KK PDF)",
                "ru": "ЕНТ · География · 5 вариантов (KK PDF)",
                "en": "ENT · Geography · 5 variants (KK PDF)",
            },
            kk_pdf,
            "kk",
        ),
        build_bank(
            "ent-geo-ru-5x175-incomplete",
            {
                "kk": "ЕНТ · География · 5 нұсқа (RU PDF)",
                "ru": "ЕНТ · География · 5 вариантов (RU PDF)",
                "en": "ENT · Geography · 5 variants (RU PDF)",
            },
            ru_pdf,
            "ru",
        ),
    ]

    for bank in banks:
        count = sum(len(t["questions"]) for t in bank["topics"])
        print(bank["id"], "questions:", count, "topics:", len(bank["topics"]))

    OUT.write_text(json.dumps(banks, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
