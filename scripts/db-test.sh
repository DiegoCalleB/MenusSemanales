#!/usr/bin/env bash
# Levanta un Postgres efímero, aplica las migraciones y ejecuta los tests SQL.
#   - En CI (GitHub Actions) se usa el servicio postgres:17 (PGHOST/PGPORT/PGUSER/PGPASSWORD).
#   - En local, si no hay PGHOST, arranca un clúster temporal con los binarios de Postgres instalados.
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL_OPTS=(-v ON_ERROR_STOP=1 -X -q)
cleanup() { :; }

if [[ -z "${PGHOST:-}" ]]; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
  DATA="$(mktemp -d)"; SOCK="$(mktemp -d)"
  chmod 700 "$DATA"
  if [[ "$(id -u)" == "0" ]]; then
    id pgtest >/dev/null 2>&1 || useradd -m pgtest
    chown pgtest "$DATA" "$SOCK"
    RUN=(runuser -u pgtest --)
  else
    RUN=()
  fi
  "${RUN[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-k $SOCK -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
  cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA" "$SOCK"; }
  trap cleanup EXIT
  export PGHOST="$SOCK" PGUSER=postgres
fi

createdb_name="menus_test_$$"
psql "${PSQL_OPTS[@]}" -d postgres -c "create database $createdb_name" >/dev/null
export PGDATABASE="$createdb_name"

psql "${PSQL_OPTS[@]}" -f supabase/tests/00_shim_auth.sql
for f in supabase/migrations/*.sql; do
  echo "→ migración $(basename "$f")"
  psql "${PSQL_OPTS[@]}" -f "$f"
done
for f in supabase/tests/*.test.sql; do
  echo "→ test $(basename "$f")"
  # El código de salida de psql manda: cualquier excepción en el test falla el script.
  if ! salida="$(psql -v ON_ERROR_STOP=1 -X -f "$f" 2>&1)"; then
    echo "$salida"
    echo "✗ FALLÓ $(basename "$f")" >&2
    exit 1
  fi
  echo "$salida" | sed -n -e 's/^psql:[^ ]* NOTICE:  /  /p' -e '/^TODOS/p'
done
