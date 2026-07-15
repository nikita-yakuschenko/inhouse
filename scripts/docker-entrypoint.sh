#!/bin/sh
set -e

echo "[entrypoint] waiting for database / applying schema..."
i=0
until npx prisma db push; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "[entrypoint] database is not ready after retries"
    exit 1
  fi
  echo "[entrypoint] retry db push ($i)..."
  sleep 2
done

echo "[entrypoint] seed (upsert, безопасный)"
npx tsx prisma/seed.ts

echo "[entrypoint] starting app"
exec npm start
