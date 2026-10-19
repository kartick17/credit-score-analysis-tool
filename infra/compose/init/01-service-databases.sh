#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=customer_password="$CUSTOMER_DB_PASSWORD" \
  --set=assessment_password="$ASSESSMENT_DB_PASSWORD" \
  --set=reporting_password="$REPORTING_DB_PASSWORD" <<'SQL'
CREATE ROLE customer_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'customer_password';
CREATE ROLE assessment_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'assessment_password';
CREATE ROLE reporting_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'reporting_password';
CREATE DATABASE customer_data_db OWNER customer_app;
CREATE DATABASE assessment_db OWNER assessment_app;
CREATE DATABASE reporting_db OWNER reporting_app;
REVOKE ALL ON DATABASE customer_data_db, assessment_db, reporting_db, postgres, template1 FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE customer_data_db TO customer_app;
GRANT CONNECT, TEMPORARY ON DATABASE assessment_db TO assessment_app;
GRANT CONNECT, TEMPORARY ON DATABASE reporting_db TO reporting_app;
\connect customer_data_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO customer_app;
\connect assessment_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO assessment_app;
\connect reporting_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO reporting_app;
SQL
