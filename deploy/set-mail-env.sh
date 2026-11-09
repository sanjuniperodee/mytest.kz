#!/usr/bin/env bash
# Writes the Resend SMTP settings into the prod API .env.
# The API key is read without echo and sent over ssh stdin, so it never lands in
# argv, shell history or logs. Run: bash deploy/set-mail-env.sh
set -euo pipefail

SSH_KEY=${SSH_KEY:-$HOME/.ssh/bilimland-prod/ssh-key-1778196525864}
PROD_HOST=${PROD_HOST:-sanjuniperodee@94.131.93.92}

read -rsp "Resend API key (re_...): " K
echo
if [[ $K != re_* ]]; then
  echo "Это не похоже на ключ Resend (он начинается с re_). Ничего не записано." >&2
  exit 1
fi

REMOTE='set -e
read -r K
f=~/bilimland/apps/api/.env
cp "$f" "$f.bak-mail-$(date +%F-%H%M%S)"
[ -z "$(tail -c1 "$f")" ] || echo >> "$f"
sed -i -E "/^(SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|SMTP_PASS|MAIL_FROM|MAIL_DAILY_CAP)=/d" "$f"
{
  echo SMTP_HOST=smtp.resend.com
  echo SMTP_PORT=465
  echo SMTP_SECURE=true
  echo SMTP_USER=resend
  echo "SMTP_PASS=$K"
  echo "MAIL_FROM=\"mytest <noreply@my-test.kz>\""
  echo MAIL_DAILY_CAP=90
} >> "$f"
chmod 600 "$f"
echo "Готово: в .env $(grep -cE "^(SMTP_|MAIL_)" "$f") строк почты, права $(stat -c %a "$f")"'

printf '%s\n' "$K" | ssh -i "$SSH_KEY" "$PROD_HOST" "$REMOTE"
unset K
