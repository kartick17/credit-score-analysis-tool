#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo 'Start Docker Desktop, then try again.' >&2
  exit 1
fi

python3 - <<'PY'
import socket

busy = []
for port in (8080, 8081, 8082, 8083, 5173, 5174):
    with socket.socket() as connection:
        if connection.connect_ex(('127.0.0.1', port)) == 0:
            busy.append(str(port))
if busy:
    raise SystemExit('Stop local apps using these ports before continuing: ' + ', '.join(busy))
PY

python3 scripts/init-local-env.py
./scripts/db.sh up -d --wait
python3 scripts/identity.py
./mvnw -B clean verify
python3 scripts/check-db-isolation.py

cd frontend/portal
npm ci --cache ../../.cache/npm
npm run format:check
npm run lint
npm run build
npm test
npx --no-install playwright install chromium
CI=true npm run test:e2e
CI=true npm run test:identity

echo 'Local build and browser flows passed. Containers remain available for local use.'
