"""Create missing local credentials without displaying their values."""
from pathlib import Path
import os
import secrets

path = Path(__file__).resolve().parents[1] / 'infra/compose/.env'
names = ('POSTGRES_PASSWORD', 'CUSTOMER_DB_PASSWORD', 'ASSESSMENT_DB_PASSWORD',
         'REPORTING_DB_PASSWORD', 'KEYCLOAK_ADMIN_PASSWORD', 'STAFF_PASSWORD')
fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_APPEND, 0o600)
with os.fdopen(fd, 'r+') as stream:
    content = stream.read()
    present = {line.split('=', 1)[0] for line in content.splitlines() if '=' in line}
    missing = [name for name in names if name not in present]
    if missing and content and not content.endswith('\n'):
        stream.write('\n')
    for name in missing:
        stream.write(f'{name}={secrets.token_hex(24)}\n')
print('Local credentials are ready in the ignored environment file.')
