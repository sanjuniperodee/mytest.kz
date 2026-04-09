#!/usr/bin/env python3
"""Parse extracted PDF .txt files into merged RU+KK question bank JSON."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent / "extracted-pdf"
OUT = Path(__file__).resolve().parent.parent / "math-literacy-seed-data.json"

ANSWER_RE = re.compile(
    r"^(?:Ответ|Жауап|Жауабы|Жауаб)\s*:?\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
NUM_START = re.compile(r"^(?P<n>\d+)\)\s*(?P<rest>.*)$", re.DOTALL)


def strip_section_emoji(text: str) -> str:
    return re.sub(r"^📘[^\n]*\n?", "", text, flags=re.MULTILINE)


def fix_kazakh_65_raw(text: str) -> str:
    """PDF иногда не тянет строку «Жауап» — подставляем по русской версии."""
    text = re.sub(
        r"(D\) 700 мың теңге)\n(11\))",
        r"\1\nЖауап: C) 751,2 мың теңге\n\2",
        text,
    )
    text = re.sub(
        r"(D\) 14)\n(30\)\s+Комбинаторика)",
        r"\1\nЖауап: C) 30\n\2",
        text,
    )
    text = re.sub(
        r"(D\) 3)\n(9\)\s+Ықтималдық)",
        r"\1\nЖауап: B) 2\n\2",
        text,
    )
    return text


def split_blocks(text: str) -> list[str]:
    text = strip_section_emoji(text.strip())
    # Split before "N) " at line start
    parts = re.split(r"(?=^(?:\d+)\)\s)", text, flags=re.MULTILINE)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if re.match(r"^\d+\)\s", p):
            out.append(p)
    return out


def parse_answer_line(block: str) -> Tuple[Optional[str], str]:
    """Return (letter A-D or None, block without answer line)."""
    lines = block.strip().split("\n")
    ans_idx = None
    ans_letter = None
    for i in range(len(lines) - 1, -1, -1):
        m = ANSWER_RE.match(lines[i].strip())
        if m:
            ans_idx = i
            tail = m.group(1).strip()
            lm = re.search(r"([ABCD])\b", tail, re.I)
            if lm:
                ans_letter = lm.group(1).upper()
            break
    if ans_idx is None:
        return None, block
    new_lines = lines[:ans_idx] + lines[ans_idx + 1 :]
    return ans_letter, "\n".join(new_lines).strip()


def parse_options(block: str):
    """Return stem text and {A: text, B: text, ...}"""
    lines = block.split("\n")
    idx_a = None
    opt_line_re = re.compile(r"^[ \t\-–]*([ABCD])\s*\)\s*")
    for i, ln in enumerate(lines):
        s = ln.strip()
        if opt_line_re.match(s):
            idx_a = i
            break
    if idx_a is None:
        return None, None
    stem = "\n".join(lines[:idx_a]).strip()
    opt_lines = lines[idx_a:]
    opts: dict[str, str] = {}
    current = None
    buf: list[str] = []
    letter_order = ["A", "B", "C", "D"]
    for ln in opt_lines:
        s = ln.strip()
        m = re.match(r"^[ \t\-–]*([ABCD])\s*\)\s*(.*)$", s)
        if m:
            if current is not None:
                opts[current] = "\n".join(buf).strip()
            current = m.group(1).upper()
            buf = [m.group(2).strip()] if m.group(2).strip() else []
        elif current is not None:
            buf.append(s)
    if current is not None:
        opts[current] = "\n".join(buf).strip()
    for L in letter_order:
        if L not in opts:
            return None, None
    return stem, opts


def clean_stem(stem: str) -> str:
    stem = re.sub(r"^\d+\)\s*", "", stem, count=1, flags=re.DOTALL).strip()
    return stem


def parse_file(path: Path) -> dict[int, dict]:
    text = path.read_text(encoding="utf-8")
    if "65" in path.name and "Каз" in path.name:
        text = fix_kazakh_65_raw(text)
    blocks = split_blocks(text)
    out: dict[int, dict] = {}
    for b in blocks:
        m = NUM_START.match(b)
        if not m:
            continue
        n = int(m.group("n"))
        letter, rest = parse_answer_line(b)
        stem_raw, opts = parse_options(rest)
        if not stem_raw or not opts or not letter:
            continue
        stem = clean_stem(stem_raw)
        out[n] = {
            "stem": stem,
            "options": opts,
            "correct": letter,
            "source": path.name,
        }
    return out


def merge_banks(
    ru: dict,
    kk: dict,
    correct_overrides: Optional[dict] = None,
) -> list:
    correct_overrides = correct_overrides or {}
    nums = sorted(set(ru.keys()) & set(kk.keys()))
    merged = []
    for n in nums:
        r, k = ru[n], kk[n]
        letter = correct_overrides.get(n, r["correct"])
        # If KK disagrees, trust override or RU
        if letter not in r["options"]:
            letter = r["correct"]
        merged.append(
            {
                "n": n,
                "stemRu": r["stem"],
                "stemKk": k["stem"],
                "optionsRu": r["options"],
                "optionsKk": k["options"],
                "correct": letter,
            }
        )
    return merged


def main():
    banks = [
        {
            "id": "bank-22",
            "label": {"kk": "ЕНТ · Математикалық сауаттылық · 22 сұрақ (PDF)", "ru": "ЕНТ · Математическая грамотность · банк 22 (PDF)", "en": "ENT · Math literacy · 22 (PDF)"},
            "ru": ROOT / "Мат Сауат Рус 22вопроса (1).txt",
            "kk": ROOT / "Мат Сауат Каз 22вопроса (1).txt",
            "overrides": {},
        },
        {
            "id": "bank-35",
            "label": {"kk": "ЕНТ · Математикалық сауаттылық · 35 сұрақ (PDF)", "ru": "ЕНТ · Математическая грамотность · банк 35 (PDF)", "en": "ENT · Math literacy · 35 (PDF)"},
            "ru": ROOT / "Мат Сауат 35вопросов Рус новый (1).txt",
            "kk": ROOT / "Мат Сауат 35вопросов Каз в 32вопросе ответ другой.txt",
            # RU D = 4 верно; в казахском PDF ошибочно A — ставим D
            "overrides": {32: "D"},
        },
        {
            "id": "bank-65",
            "label": {"kk": "ЕНТ · Математикалық сауаттылық · 65 сұрақ (PDF)", "ru": "ЕНТ · Математическая грамотность · банк 65 (PDF)", "en": "ENT · Math literacy · 65 (PDF)"},
            "ru": ROOT / "Мат Сауат Рус 65вопроса (1).txt",
            "kk": ROOT / "Мат сауат 65вопросов Каз (1).txt",
            "overrides": {},
        },
    ]

    all_banks = []
    for b in banks:
        ru = parse_file(b["ru"])
        kk = parse_file(b["kk"])
        merged = merge_banks(ru, kk, b["overrides"])
        all_banks.append(
            {
                "id": b["id"],
                "label": b["label"],
                "questions": merged,
            }
        )
        print(b["id"], "questions:", len(merged), "ru keys", len(ru), "kk keys", len(kk))

    OUT.write_text(json.dumps(all_banks, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
