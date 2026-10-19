"""Create local credentials once; never print or overwrite existing secrets."""
from pathlib import Path
import os
import secrets

path = Path(__file__).resolve().parents[1] / 'infra/compose/.env'
try:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    print('Local environment already exists; left unchanged.')
else:
    with os.fdopen(fd, 'w') as stream:
        for name in ('POSTGRES_PASSWORD', 'CUSTOMER_DB_PASSWORD', 'ASSESSMENT_DB_PASSWORD', 'REPORTING_DB_PASSWORD'):
            stream.write(f'{name}={secrets.token_hex(24)}\n')
    print('Created ignored infra/compose/.env with permissions 0600.')
