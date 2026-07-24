#!/bin/sh
# Garante que o volume /app/data seja gravável pelo user nodejs.
# No Railway o mount de volume sobrescreve o owner do build (root).
set -eu

DATA_ROOT="${RAILWAY_VOLUME_MOUNT_PATH:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_ROOT/fiscal-certs" "$DATA_ROOT/fiscal-xmls"
  chown -R nodejs:nodejs "$DATA_ROOT" 2>/dev/null || true
  chmod -R u+rwX "$DATA_ROOT" 2>/dev/null || true
  exec su-exec nodejs "$@"
fi

mkdir -p "$DATA_ROOT/fiscal-certs" "$DATA_ROOT/fiscal-xmls" 2>/dev/null || true
exec "$@"
