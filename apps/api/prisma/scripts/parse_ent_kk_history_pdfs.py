#!/usr/bin/env python3
"""ENT Қазақстан тарихы (KK) — три PDF → history-kz-ent-kk-seed-data.json

Ожидает prisma/extracted-pdf/ent-kk/*.txt (pypdf).
Запуск: python3 prisma/scripts/parse_ent_kk_history_pdfs.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

ENT_KK_DIR = Path(__file__).resolve().parent.parent / "extracted-pdf" / "ent-kk"
OUT = Path(__file__).resolve().parent.parent / "history-kz-ent-kk-seed-data.json"

QUESTION_START = re.compile(r"^(\d+)\)\s*(.*)$")
OPTION_START = re.compile(r"^([ABCD])\)\s*(.*)$", re.IGNORECASE)

# Жауап: A / Жауабы: D / 👉 Жауабы: A / ✅ Дұрыс жауап: C)
ANSWER_PATTERNS = [
    re.compile(
        r"(?:👉\s*)?(?:Жауабы|Жауап)\s*:\s*([ABCD])(?:\s*\)|\b)",
        re.IGNORECASE,
    ),
    re.compile(
        r"✅\s*Дұрыс\s+жауап\s*:\s*([ABCD])\s*\)?",
        re.IGNORECASE,
    ),
]

# Заголовок файла — не отдельная тема
SKIP_TOPIC_TITLES = frozenset(
    {
        "қазақстан тарихы",
        "история казахстана",
    }
)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def is_topic_line(line: str) -> bool:
    s = line.strip()
    if len(s) < 4 or len(s) > 140:
        return False
    if QUESTION_START.match(s):
        return False
    if OPTION_START.match(s):
        return False
    if s.startswith("👉") or s.startswith("✅"):
        return False
    if re.match(r"^(?:Жауабы|Жауап|Дұрыс)\s*:", s, re.I):
        return False
    if "?" in s and len(s) > 40:
        return False
    return True


def extract_answer(block: str) -> tuple[Optional[str], str]:
    """Последнее совпадение ответа; возвращает (буква, блок без строки ответа)."""
    best_i = -1
    best_letter = None
    for pat in ANSWER_PATTERNS:
        for m in pat.finditer(block):
            if m.start() >= best_i:
                best_i = m.start()
                best_letter = m.group(1).upper()
    if best_letter is None:
        return None, block
    return best_letter, block[:best_i].strip()


def parse_options_and_stem(body: str) -> Optional[tuple[str, dict[str, str]]]:
    body = norm(body)
    fm = re.search(r"(?:^|\s)([ABCD])\)\s*", body, re.IGNORECASE)
    if not fm:
        return None
    letter_pos = fm.start(1)
    stem = body[:letter_pos].strip()
    opt_text = body[letter_pos:].strip()
    opts: dict[str, str] = {}
    chunk = re.compile(
        r"([ABCD])\)\s*((?:(?!\s[A-D]\)\s*).)*)",
        re.IGNORECASE | re.DOTALL,
    )
    for m in chunk.finditer(opt_text):
        opts[m.group(1).upper()] = m.group(2).strip()
    if set(opts.keys()) != {"A", "B", "C", "D"}:
        return None
    return stem, opts


def parse_file_lines(path: Path, default_topic: str) -> list[tuple[str, dict[str, Any]]]:
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    topic = default_topic
    buf: list[str] = []
    out: list[tuple[str, dict[str, Any]]] = []

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
                    "stemKk": stem,
                    "optionsKk": opts,
                    "correct": letter,
                    "contentLocale": "kk",
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
                if any(p.search(joined) for p in ANSWER_PATTERNS):
                    flush()
                else:
                    buf.append(s)
                    continue
            low = norm(s).lower()
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


def build_bank(
    bank_id: str,
    label_kk: str,
    label_ru: str,
    path: Path,
) -> dict[str, Any]:
    rows = parse_file_lines(path, default_topic="Жалпы")
    topics_map: dict[str, list[dict[str, Any]]] = {}
    for tname, q in rows:
        topics_map.setdefault(tname, []).append(q)
    topics_out = []
    for tname in sorted(topics_map.keys(), key=lambda x: (x == "Жалпы", x)):
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
            "en": "ENT · History of Kazakhstan · KK PDF",
        },
        "topics": topics_out,
    }


def main() -> None:
    if not ENT_KK_DIR.is_dir():
        raise SystemExit(f"Missing {ENT_KK_DIR}")

    banks = [
        build_bank(
            "ent-kk-30-hard",
            "ЕНТ · Қазақстан тарихы · 30 қиын сұрақ (PDF)",
            "ЕНТ · История Казахстана · 30 сложных (PDF)",
            ENT_KK_DIR / "ent-kk-30-hard.txt",
        ),
        build_bank(
            "ent-kk-126",
            "ЕНТ · Қазақстан тарихы · 126 сұрақ (PDF)",
            "ЕНТ · История Казахстана · 126 вопросов (PDF)",
            ENT_KK_DIR / "ent-kk-126.txt",
        ),
        build_bank(
            "ent-kk-105",
            "ЕНТ · Қазақстан тарихы · 105 сұрақ (PDF)",
            "ЕНТ · История Казахстана · 105 вопросов (PDF)",
            ENT_KK_DIR / "ent-kk-105.txt",
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
