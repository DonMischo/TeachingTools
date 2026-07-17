#!/bin/sh
# No production deployment yet, so schema management is intentionally simple:
# Base.metadata.create_all() (in main.py's startup handler) creates any
# missing tables/columns for a fresh DB, and the raw-SQL list in
# _run_migrations() (also main.py) covers additive columns on tables that
# already exist from an older run. Invoked via `sh ./api/entrypoint.sh` so it
# works even when the bind-mounted ./api volume (dev mode) doesn't preserve
# the executable bit.
set -e
cd /workspace
exec "$@"
