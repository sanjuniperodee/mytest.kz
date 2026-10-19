#!/usr/bin/env bash
# Выкатка my-test (сайт apps/web → PM2 mytest-v2, API apps/api → PM2 bilimland-api) из готового архива GitHub Actions.
# Сервер не собирает: сборка не помещалась в его память рядом с другими сайтами и тормозила их.
# Запуск на сервере из корня репозитория (его делает deploy/ci-run.sh, код уже обновлён до коммита архива):
#   bash deploy/deploy.sh --artifact <архив.tgz> <коммит, который работал до выкатки>
# Порядок: зависимости (если поменялись) → Prisma → миграции (если есть новые) → подмена сборок → перезапуск → проверка.
# Не ответило после перезапуска — возвращаются прежние сборки.
set -euo pipefail
[ "${1:-}" = "--artifact" ] || { echo "Использование: bash deploy/deploy.sh --artifact <архив.tgz> <прежний коммит>"; exit 1; }
ARCHIVE="$(readlink -f "${2:?укажите архив сборки}")"
OLD="${3:?укажите прежний коммит}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SHA="$(git rev-parse HEAD)"
PREV="${MYTEST_PREV_DIR:-$HOME/mytest-prev}"

# Две выкатки сразу спорят за папки сборок — вторая ждёт первую.
exec 9>"$HOME/.mytest-deploy.lock"
flock -w 1800 9 || { echo "✗ Другая выкатка идёт дольше 30 минут — эта не запущена"; exit 1; }

UNPACK="$(mktemp -d "$HOME/mytest-unpack.XXXXXX")"
trap 'rm -rf "$UNPACK"' EXIT
tar -xzf "$ARCHIVE" -C "$UNPACK"
BUILT="$(cat "$UNPACK/BUILD_SHA" 2>/dev/null || true)"
[ "$BUILT" = "$SHA" ] || { echo "✗ Архив собран из ${BUILT:-неизвестного коммита}, а код на сервере — $SHA. Ничего не тронуто."; exit 1; }
echo "→ Выкатка ${SHA:0:7} (было ${OLD:0:7})"

changed() { ! git diff --quiet "$OLD" "$SHA" -- "$@"; }
quiet() { nice -n 19 ionice -c 3 "$@"; }

# npm install, а не npm ci: ci удаляет node_modules целиком, а работающий сайт подгружает модули из них по ходу.
if changed package-lock.json; then
  echo "→ Зависимости поменялись — npm install"
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 quiet npm install --no-audit --no-fund
fi
if changed package-lock.json apps/api/prisma/schema.prisma; then
  echo "→ Prisma generate"
  (cd apps/api && quiet npx prisma generate)
fi
if changed apps/api/prisma/migrations; then
  echo "→ Новые миграции — migrate:deploy:safe"
  (cd apps/api && npm run migrate:deploy:safe)
fi

# Сборки подменяются целиком; прежние — в $PREV, для отката.
SLOTS=("web-next:apps/web/.next" "api-dist:apps/api/dist" "shared-dist:packages/shared/dist")
swap_in() {
  local slot name target
  rm -rf "$PREV" && mkdir -p "$PREV"
  for slot in "${SLOTS[@]}"; do
    name="${slot%%:*}" target="${slot#*:}"
    [ -e "$target" ] && mv "$target" "$PREV/$name"
    mv "$UNPACK/$name" "$target"
  done
}
swap_back() {
  local slot name target
  for slot in "${SLOTS[@]}"; do
    name="${slot%%:*}" target="${slot#*:}"
    [ -e "$PREV/$name" ] || continue
    rm -rf "$target" && mv "$PREV/$name" "$target"
  done
}

# Сайт должен отдать главную (200), API — ответить хоть чем-то по HTTP (у корня API 404 — это нормально).
healthy() {
  local i
  for i in $(seq 1 60); do
    if [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' localhost:3000/)" = 200 ] &&
       [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' localhost:3001/)" != 000 ]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "→ Подмена сборок и перезапуск"
swap_in
pm2 restart mytest-v2 bilimland-api >/dev/null
if ! healthy; then
  echo "✗ После перезапуска сайт или API не ответили — возвращаю прежние сборки."
  swap_back
  pm2 restart mytest-v2 bilimland-api >/dev/null
  healthy && echo "  прежняя версия работает" || echo "  ✗ и прежняя версия не отвечает: pm2 logs mytest-v2 / bilimland-api"
  exit 1
fi
pm2 save >/dev/null
echo "✓ my-test работает на ${SHA:0:7}"
