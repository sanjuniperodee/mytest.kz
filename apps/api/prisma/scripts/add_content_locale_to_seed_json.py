#!/usr/bin/env python3
"""
Проставляет contentLocale только kk/ru (без both).
- math: поле у вопросов удаляется (сидаются две записи kk+ru).
- reading bank-19: поле удаляется (две записи в сиде).
- reading bank-*-kk / *-ru: kk или ru.
- history: уже kk / ru.
"""
from __future__ import annotations

import json
from pathlib import Path

PRISMA = Path(__file__).resolve().parent.parent


def main() -> None:
    math_path = PRISMA / "math-literacy-seed-data.json"
    if math_path.is_file():
        data = json.loads(math_path.read_text(encoding="utf-8"))
        n = 0
        for bank in data:
            for q in bank.get("questions", []):
                q.pop("contentLocale", None)
                n += 1
        math_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(math_path.name, "stripped locale from", n, "questions")

    read_path = PRISMA / "reading-literacy-seed-data.json"
    if read_path.is_file():
        data = json.loads(read_path.read_text(encoding="utf-8"))
        for bank in data:
            bid = str(bank.get("id", ""))
            for q in bank.get("questions", []):
                if bid == "bank-19":
                    q.pop("contentLocale", None)
                elif bid in ("bank-35-kk", "bank-50-kk"):
                    q["contentLocale"] = "kk"
                elif bid == "bank-82-ru":
                    q["contentLocale"] = "ru"
                else:
                    q.pop("contentLocale", None)
        read_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(read_path.name, "updated")

    for name, loc in (
        ("history-kz-ent-kk-seed-data.json", "kk"),
        ("history-kz-ent-ru-seed-data.json", "ru"),
    ):
        p = PRISMA / name
        if not p.is_file():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        for bank in data:
            for topic in bank.get("topics", []):
                for q in topic.get("questions", []):
                    q["contentLocale"] = loc
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(p.name, "->", loc)


if __name__ == "__main__":
    main()
