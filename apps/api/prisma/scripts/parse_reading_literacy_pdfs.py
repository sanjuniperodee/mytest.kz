#!/usr/bin/env python3
"""Parse extracted reading-literacy PDF .txt → reading-literacy-seed-data.json.

- Подставляет общий мәтін/текст ко всем вопросам одного номера текста, если в PDF
  текст дан один раз (типично KK 19), а дальше только «Мәтін 1 … вопрос».
- После сборки всех банков нумерация «Мәтін N / Текст N» сквозная между банками.

Запуск из apps/api: python3 prisma/scripts/parse_reading_literacy_pdfs.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

READING_DIR = Path(__file__).resolve().parent.parent / "extracted-pdf" / "reading"
OUT = Path(__file__).resolve().parent.parent / "reading-literacy-seed-data.json"

# Обязательное «:» у Жауап/Ответ — иначе «…екінші жауап B)» даёт ложное совпадение.
ANSWER_STRICT = re.compile(
    r"(?:Ответ|Жауап|Жауабы|Жауаб)\s*:\s*([ABCD])(?:\s*\)|\b)",
    re.IGNORECASE,
)
# «Ответ B)» без двоеточия (встречается в RU PDF)
ANSWER_LOOSE = re.compile(r"Ответ\s+([ABCD])\s*\)", re.IGNORECASE)


def split_answer_suffix(body: str) -> tuple[Optional[str], str]:
    """Берём последнее вхождение строки ответа (обычно в конце блока)."""
    best_m = None
    for m in ANSWER_STRICT.finditer(body):
        best_m = m
    if best_m:
        return best_m.group(1).upper(), body[: best_m.start()].strip()
    best_m = None
    for m in ANSWER_LOOSE.finditer(body):
        best_m = m
    if best_m:
        return best_m.group(1).upper(), body[: best_m.start()].strip()
    return None, body


FIRST_OPTION = re.compile(r"(?:^|\s)([ABCD])\)\s*", re.IGNORECASE)
OPTION_CHUNK = re.compile(
    r"([ABCD])\)\s*((?:(?!\s[A-D]\)\s*).)*)",
    re.IGNORECASE | re.DOTALL,
)

# Заголовок вопроса: Мәтін / Мəтін (ə U+0259) / Текст + номер
TEXT_HEAD = re.compile(
    r"^(М(?:(?:ә|е|\u0259|і|i)тін)|Текст)\s+(\d+)\s*(.*)$",
    re.IGNORECASE | re.DOTALL,
)

# Начало формулировки задания (после основного текста)
QUESTION_STARTERS = [
    # Қазақша
    r"М[әеəі\u0259]тінге\s+",
    r"М[әеəі\u0259]тін\s+бойынша",
    r"М[әеəі\u0259]тіннің\s+стилін",
    r"М[әеəі\u0259]тінінде\s+",
    r"М[әеəі\u0259]тінде\s+",
    r"Жетіспейтін\s+",
    r"Қате\s+тұжырым",
    r"Сәйкес,",
    r"Сәйкес\s+",
    # Орысша
    r"Утверждение[,\s]",
    r"Пропущенное\s+слово",
    r"Выберите\s+",
    r"В\s+каком\s+абзаце",
    r"Согласно\s+тексту",
    r"Что\s+изначально",
    r"Что\s+да[её]т",
    r"Что\s+дает",
    r"Ягель\s+–\s+это",
    r"За\s+год\s+ягель",
    r"Значение\s+слова",
    r"Основная\s+мысль",
    r"В\s+каком\s+предложении",
    r"Определите\s+",
    r"Укажите\s+",
]
_STARTER_RES = [re.compile(p, re.IGNORECASE) for p in QUESTION_STARTERS]


def normalize_pdf_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r" +", " ", text)
    return text.strip()


def split_numbered_blocks(text: str) -> list[tuple[int, str]]:
    text = normalize_pdf_text(text)
    matches = list(
        re.finditer(r"(?<!\()(?<![0-9])([1-9][0-9]{0,2})\)\s", text),
    )
    out: list[tuple[int, str]] = []
    for i, m in enumerate(matches):
        n = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        out.append((n, body))
    return out


def parse_options_segment(opt_text: str) -> Optional[dict[str, str]]:
    opts: dict[str, str] = {}
    for m in OPTION_CHUNK.finditer(opt_text.strip()):
        letter = m.group(1).upper()
        opts[letter] = m.group(2).strip()
    if set(opts.keys()) != {"A", "B", "C", "D"}:
        return None
    return opts


def parse_single_lang_block(body: str) -> Optional[dict[str, Any]]:
    body = body.strip()
    letter, before = split_answer_suffix(body)
    if not letter:
        return None
    fm = FIRST_OPTION.search(before)
    if not fm:
        return None
    letter_pos = fm.start(1)
    stem = before[:letter_pos].strip()
    opt_text = before[letter_pos:].strip()
    opts = parse_options_segment(opt_text)
    if not opts or letter not in opts:
        return None
    return {"stem": stem, "options": opts, "correct": letter}


def parse_file(path: Path) -> dict[int, dict[str, Any]]:
    raw = path.read_text(encoding="utf-8")
    out: dict[int, dict[str, Any]] = {}
    for n, body in split_numbered_blocks(raw):
        p = parse_single_lang_block(body)
        if p:
            out[n] = p
    return out


def _find_question_split(rest: str) -> Optional[int]:
    best: Optional[int] = None
    for rx in _STARTER_RES:
        m = rx.search(rest)
        if m:
            if best is None or m.start() < best:
                best = m.start()
    return best


def enrich_carry_passages(items: dict[int, dict[str, Any]], min_passage_len: int = 50) -> None:
    """Для каждого номера мәтін/текст запоминает основной абзац и подставляет к коротким вопросам."""
    passages: dict[int, str] = {}

    for n in sorted(items.keys()):
        stem = items[n]["stem"]
        m = TEXT_HEAD.match(stem.strip())
        if not m:
            continue

        label = m.group(1)
        tid = int(m.group(2))
        rest = (m.group(3) or "").strip()
        pos = _find_question_split(rest)

        if pos is not None and pos >= min_passage_len:
            passage = rest[:pos].strip()
            question = rest[pos:].strip()
            if len(passage) >= min_passage_len:
                passages[tid] = passage
            items[n]["stem"] = f"{label} {tid} {passage} {question}".strip()
        elif pos is not None and pos < min_passage_len:
            question = rest
            cached = passages.get(tid, "")
            if cached:
                items[n]["stem"] = f"{label} {tid} {cached} {question}".strip()
        else:
            cached = passages.get(tid, "")
            if cached and len(rest) <= 220:
                items[n]["stem"] = f"{label} {tid} {cached} {rest}".strip()
            elif len(rest) >= min_passage_len and not cached:
                passages[tid] = rest


def merge_banks(
    ru: dict[int, dict],
    kk: dict[int, dict],
    correct_overrides: Optional[dict[int, str]] = None,
) -> list[dict[str, Any]]:
    correct_overrides = correct_overrides or {}
    nums = sorted(set(ru.keys()) & set(kk.keys()))
    merged: list[dict[str, Any]] = []
    for n in nums:
        r, k = ru[n], kk[n]
        letter = correct_overrides.get(n, r["correct"])
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


def single_lang_to_questions(items: dict[int, dict], *, kk_primary: bool) -> list[dict[str, Any]]:
    loc = "kk" if kk_primary else "ru"
    merged: list[dict[str, Any]] = []
    for n in sorted(items.keys()):
        q = items[n]
        stem = q["stem"]
        opts = q["options"]
        merged.append(
            {
                "n": n,
                "stemRu": stem,
                "stemKk": stem,
                "optionsRu": opts,
                "optionsKk": opts,
                "correct": q["correct"],
                "contentLocale": loc,
            }
        )
    return merged


# Сквозная нумерация: (bank_id, локальный_номер_текста) → глобальный
TEXT_NUM_IN_STEM = re.compile(
    r"(М(?:(?:ә|е|\u0259|і|i)тін)|Текст)\s+(\d+)\b",
    re.IGNORECASE,
)


class GlobalTextRenumber:
    def __init__(self) -> None:
        self.next_id = 1
        self.seen: dict[tuple[str, int], int] = {}

    def renumber(self, stem: str, bank_id: str) -> str:
        def repl(m: re.Match[str]) -> str:
            label = m.group(1)
            loc = int(m.group(2))
            key = (bank_id, loc)
            if key not in self.seen:
                self.seen[key] = self.next_id
                self.next_id += 1
            return f"{label} {self.seen[key]}"

        return TEXT_NUM_IN_STEM.sub(repl, stem)

    def apply_bank(self, bank: dict[str, Any]) -> None:
        bid = bank["id"]
        for q in bank["questions"]:
            q["stemRu"] = self.renumber(q["stemRu"], bid)
            q["stemKk"] = self.renumber(q["stemKk"], bid)


def main() -> None:
    if not READING_DIR.is_dir():
        raise SystemExit(f"Missing {READING_DIR}")

    banks_spec: list[dict[str, Any]] = [
        {
            "id": "bank-19",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 19 сұрақ (PDF)",
                "ru": "ЕНТ · Грамотность чтения · банк 19 (PDF)",
                "en": "ENT · Reading literacy · 19 (PDF)",
            },
            "mode": "merge",
            "ru": READING_DIR / "reading-19-ru.txt",
            "kk": READING_DIR / "reading-19-kk.txt",
            "overrides": {},
        },
        {
            "id": "bank-35-kk",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 35 сұрақ (PDF, KK)",
                "ru": "ЕНТ · Грамотность чтения · банк 35 (PDF, KK)",
                "en": "ENT · Reading literacy · 35 (PDF, KK)",
            },
            "mode": "single",
            "kk_primary": True,
            "path": READING_DIR / "reading-35-kk.txt",
        },
        {
            "id": "bank-50-kk",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 50 сұрақ (PDF, KK)",
                "ru": "ЕНТ · Грамотность чтения · банк 50 (PDF, KK)",
                "en": "ENT · Reading literacy · 50 (PDF, KK)",
            },
            "mode": "single",
            "kk_primary": True,
            "path": READING_DIR / "reading-50-kk.txt",
        },
        {
            "id": "bank-82-ru",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 82 сұрақ (PDF, RU)",
                "ru": "ЕНТ · Грамотность чтения · банк 82 (PDF, RU)",
                "en": "ENT · Reading literacy · 82 (PDF, RU)",
            },
            "mode": "single",
            "kk_primary": False,
            "path": READING_DIR / "reading-82-ru.txt",
        },
    ]

    all_banks: list[dict[str, Any]] = []
    for b in banks_spec:
        if b["mode"] == "merge":
            ru_p = b["ru"]
            kk_p = b["kk"]
            if not ru_p.exists() or not kk_p.exists():
                print("SKIP merge (missing file):", b["id"], ru_p.exists(), kk_p.exists())
                continue
            ru = parse_file(ru_p)
            kk = parse_file(kk_p)
            enrich_carry_passages(ru)
            enrich_carry_passages(kk)
            questions = merge_banks(ru, kk, b.get("overrides"))
            all_banks.append({"id": b["id"], "label": b["label"], "questions": questions})
            print(b["id"], "questions:", len(questions), "ru", len(ru), "kk", len(kk))
        else:
            p = b["path"]
            if not p.exists():
                print("SKIP single (missing file):", b["id"])
                continue
            items = parse_file(p)
            enrich_carry_passages(items)
            questions = single_lang_to_questions(items, kk_primary=b["kk_primary"])
            all_banks.append({"id": b["id"], "label": b["label"], "questions": questions})
            print(b["id"], "questions:", len(questions), "parsed keys", len(items))

    renum = GlobalTextRenumber()
    for bank in all_banks:
        renum.apply_bank(bank)
    print("Global text markers: assigned", renum.next_id - 1, "distinct text numbers")

    OUT.write_text(json.dumps(all_banks, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
