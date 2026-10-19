"""Verify password authentication, own DB access, all cross-service denials, and roles."""
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
values = dict(line.split('=', 1) for line in (root / 'infra/compose/.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
services = [('customer_app', 'customer_data_db', 'CUSTOMER_DB_PASSWORD'), ('assessment_app', 'assessment_db', 'ASSESSMENT_DB_PASSWORD'), ('reporting_app', 'reporting_db', 'REPORTING_DB_PASSWORD')]
for user, own_db, key in services:
    for db in [s[1] for s in services] + ['postgres']:
        result = subprocess.run([str(root / 'scripts/db.sh'), 'exec', '-T', '-e', f'PGPASSWORD={values[key]}', 'postgres', 'psql', '-h', '127.0.0.1', '-U', user, '-d', db, '-Atc', 'SELECT current_user'], capture_output=True, text=True)
        if db == own_db:
            assert result.returncode == 0 and result.stdout.strip() == user, f'{user}: own database failed'
        else:
            assert result.returncode != 0 and 'permission denied for database' in result.stderr, f'{user}: expected CONNECT denial for {db}'
        print(f'PASS {user} -> {db}: {"allowed" if db == own_db else "denied"}')
    result = subprocess.run([str(root / 'scripts/db.sh'), 'exec', '-T', '-e', f'PGPASSWORD={values[key]}', 'postgres', 'psql', '-h', '127.0.0.1', '-U', user, '-d', own_db, '-Atc', 'SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication FROM pg_roles WHERE rolname=current_user'], capture_output=True, text=True)
    assert result.returncode == 0 and result.stdout.strip() == 'f', f'{user}: excessive privileges'
    print(f'PASS {user}: restricted role')
