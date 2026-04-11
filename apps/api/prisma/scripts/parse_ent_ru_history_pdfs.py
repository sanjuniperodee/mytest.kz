#!/usr/bin/env python3
"""ENT История Казахстана (RU PDF) — три .txt → history-kz-ent-ru-seed-data.json

Ожидает prisma/extracted-pdf/ent-ru/*.txt (pypdf).
Запуск: python3 prisma/scripts/parse_ent_ru_history_pdfs.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

ENT_RU_DIR = Path(__file__).resolve().parent.parent / "extracted-pdf" / "ent-ru"
OUT = Path(__file__).resolve().parent.parent / "history-kz-ent-ru-seed-data.json"

# Латиница и кириллица в вариантах: A B C D vs А В С D
CYR_A, CYR_V, CYR_ES = "\u0410", "\u0412", "\u0421"  # А В С

QUESTION_START = re.compile(r"^(\d+)\)\s*(.*)$")
# Первая буква варианта: A-D латиница или А/В/С кириллица
OPT_LETTER = rf"(?:[ABCD]|{CYR_A}|{CYR_V}|{CYR_ES})"
OPTION_START_LINE = re.compile(rf"^{OPT_LETTER}\)\s*(.*)$", re.IGNORECASE)

ANSWER_LETTER = rf"(?:[ABCD]|{CYR_A}|{CYR_V}|{CYR_ES})"

ANSWER_PATTERNS = [
    re.compile(
        rf"(?:✅\s*)?(?:Правильный\s+ответ|Ответ)\s*:\s*(?:✅\s*)?({ANSWER_LETTER})(?:\s*\)|\b)",
        re.IGNORECASE,
    ),
    re.compile(rf"✅\s*({ANSWER_LETTER})\s*\)", re.IGNORECASE),
]

SKIP_TOPIC_TITLES = frozenset(
    {
        "история казахстана",
        "история казахстана.",
    }
)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def letter_to_key(ch: str) -> Optional[str]:
    if not ch:
        return None
    c = ch.strip()[0]
    table = {
        "A": "A",
        "B": "B",
        "C": "C",
        "D": "D",
        CYR_A: "A",
        CYR_V: "B",
        CYR_ES: "C",
    }
    return table.get(c) or table.get(c.upper())


def is_topic_line(line: str) -> bool:
    s = line.strip()
    if len(s) < 4 or len(s) > 160:
        return False
    if QUESTION_START.match(s):
        return False
    if OPTION_START_LINE.match(s):
        return False
    if s.startswith("👉") or s.startswith("✅"):
        return False
    if re.match(r"^(?:Правильный\s+ответ|Ответ)\s*:", s, re.I):
        return False
    if "?" in s and len(s) > 45:
        return False
    if s.lower().startswith("текст:") or s.lower().startswith("вопрос:"):
        return False
    return True


def extract_answer(block: str) -> tuple[Optional[str], str]:
    best_i = -1
    best_letter: Optional[str] = None
    for pat in ANSWER_PATTERNS:
        for m in pat.finditer(block):
            if m.start() >= best_i:
                best_i = m.start()
                raw = m.group(1)
                best_letter = letter_to_key(raw)
    if not best_letter:
        return None, block
    return best_letter, block[:best_i].strip()


def parse_options_and_stem(body: str) -> Optional[tuple[str, dict[str, str]]]:
    body = norm(body)
    fm = re.search(rf"(?:^|\s)({OPT_LETTER})\)\s*", body, re.IGNORECASE)
    if not fm:
        return None
    letter_pos = fm.start(1)
    stem = body[:letter_pos].strip()
    opt_text = body[letter_pos:].strip()
    opts: dict[str, str] = {}
    chunk = re.compile(
        rf"({OPT_LETTER})\)\s*((?:(?!\s{OPT_LETTER}\)\s*).)*)",
        re.IGNORECASE | re.DOTALL,
    )
    for m in chunk.finditer(opt_text):
        key = letter_to_key(m.group(1))
        if not key:
            continue
        opts[key] = m.group(2).strip()
    if set(opts.keys()) != {"A", "B", "C", "D"}:
        return None
    return stem, opts


def parse_file_lines(path: Path, default_topic: str) -> list[tuple[str, dict[str, Any]]]:
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    topic = default_topic
    buf: list[str] = []
    out: list[tuple[str, dict[str, Any]]] = []

    def has_answer_line(text: str) -> bool:
        return any(p.search(text) for p in ANSWER_PATTERNS)

    def flush() -> None:
        nonlocal buf
        if not buf:
            return
        block = "\n".join(buf)
        buf = []
        letter, rest = extract_answer(block)
        if not letter:
            return
        parsed = parse_options_and_stem(rest)
        if not parsed:
            return
        stem, opts = parsed
        stem = norm(stem)
        if len(stem) < 3:
            return
        out.append(
            (
                topic,
                {
                    "stemRu": stem,
                    "optionsRu": opts,
                    "correct": letter,
                    "contentLocale": "ru",
                },
            )
        )

    for line in lines:
        s = line.strip()
        if not s:
            continue
        if is_topic_line(s):
            if buf:
                joined = "\n".join(buf)
                if has_answer_line(joined):
                    flush()
                else:
                    buf.append(s)
                    continue
            low = norm(s).lower().rstrip(".")
            if low not in SKIP_TOPIC_TITLES:
                topic = norm(s)
            continue
        m = QUESTION_START.match(s)
        if m:
            flush()
            buf = [s]
            continue
        if buf:
            buf.append(s)

    flush()
    return out


def _question_fingerprint(q: dict[str, Any]) -> tuple[str, str, tuple[tuple[str, str], ...]]:
    opts = q["optionsRu"]
    key = tuple(sorted((k, norm(str(v))) for k, v in opts.items()))
    stem = norm(str(q["stemRu"]))
    stem = re.sub(r"^\d+\)\s*", "", stem)
    return (stem, str(q["correct"]), key)


def build_bank(
    bank_id: str,
    label_kk: str,
    label_ru: str,
    path: Path,
) -> dict[str, Any]:
    rows = parse_file_lines(path, default_topic="Общее")
    seen: set[tuple[str, str, tuple[tuple[str, str], ...]]] = set()
    deduped: list[tuple[str, dict[str, Any]]] = []
    for tname, q in rows:
        fp = _question_fingerprint(q)
        if fp in seen:
            continue
        seen.add(fp)
        deduped.append((tname, q))
    rows = deduped

    topics_map: dict[str, list[dict[str, Any]]] = {}
    for tname, q in rows:
        topics_map.setdefault(tname, []).append(q)
    topics_out = []
    for tname in sorted(topics_map.keys(), key=lambda x: (x == "Общее", x)):
        qs = topics_map[tname]
        topics_out.append(
            {
                "name": {
                    "kk": tname,
                    "ru": tname,
                    "en": tname,
                },
                "questions": qs,
            }
        )
    return {
        "id": bank_id,
        "label": {
            "kk": label_kk,
            "ru": label_ru,
            "en": "ENT · History of Kazakhstan · RU PDF",
        },
        "topics": topics_out,
    }


def main() -> None:
    if not ENT_RU_DIR.is_dir():
        raise SystemExit(f"Missing {ENT_RU_DIR}")

    banks = [
        build_bank(
            "ent-ru-30-hard",
            "ЕНТ · Қазақстан тарихы · 30 қиын (RU PDF)",
            "ЕНТ · История Казахстана · 30 сложных (RU PDF)",
            ENT_RU_DIR / "ent-ru-30-hard.txt",
        ),
        build_bank(
            "ent-ru-126",
            "ЕНТ · Қазақстан тарихы · 126 сұрақ (RU PDF)",
            "ЕНТ · История Казахстана · 126 вопросов (RU PDF)",
            ENT_RU_DIR / "ent-ru-126.txt",
        ),
        build_bank(
            "ent-ru-105",
            "ЕНТ · Қазақстан тарихы · 105 сұрақ (RU PDF)",
            "ЕНТ · История Казахстана · 105 вопросов (RU PDF)",
            ENT_RU_DIR / "ent-ru-105.txt",
        ),
    ]

    total_q = sum(len(t["questions"]) for b in banks for t in b["topics"])
    for b in banks:
        n = sum(len(t["questions"]) for t in b["topics"])
        print(b["id"], "questions:", n, "topics:", len(b["topics"]))
    print("Total questions:", total_q)

    OUT.write_text(json.dumps(banks, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
