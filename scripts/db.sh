#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
exec docker compose --env-file infra/compose/.env -f infra/compose/compose.yml "$@"
