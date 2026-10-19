#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
case "${1:-customer-data-service}" in
  customer-data-service) service=customer-data-service; key=CUSTOMER_DB_PASSWORD ;;
  assessment-service) service=assessment-service; key=ASSESSMENT_DB_PASSWORD ;;
  reporting-service) service=reporting-service; key=REPORTING_DB_PASSWORD ;;
  api-gateway) exec ./mvnw -pl services/api-gateway spring-boot:run ;;
  *) echo 'Use customer-data-service, assessment-service, reporting-service or api-gateway' >&2; exit 2 ;;
esac
# The generated file contains KEY=hex-secret lines. Do not source arbitrary shell code.
DB_PASSWORD=$(awk -F= -v key="$key" '$1 == key {print $2}' infra/compose/.env)
: "${DB_PASSWORD:?Run scripts/init-local-env.py first}"
export DB_PASSWORD
exec ./mvnw -pl "services/$service" spring-boot:run
