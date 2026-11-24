#!/bin/sh
# Konteyner ishga tushganda: migratsiyalarni qo'llaydi, keyin asosiy buyruqni bajaradi.
# RUN_MIGRATIONS=false bilan o'chirib qo'yish mumkin (masalan, bir nechta replika bo'lsa).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] prisma migrate deploy"
  node /app/node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
