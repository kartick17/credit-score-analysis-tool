"""Assign local sample staff passwords through the identity admin API."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import json

root = Path(__file__).resolve().parents[1]
values = dict(line.split('=', 1) for line in (root / 'infra/compose/.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
base = 'http://localhost:8180'
body = urlencode({'client_id': 'admin-cli', 'grant_type': 'password',
                  'username': 'local-admin', 'password': values['KEYCLOAK_ADMIN_PASSWORD']}).encode()
with urlopen(Request(base + '/realms/master/protocol/openid-connect/token', data=body), timeout=10) as response:
    token = json.load(response)['access_token']

def call(path, data=None, method='GET'):
    request = Request(base + '/admin/realms/credit-risk' + path,
                      data=json.dumps(data).encode() if data is not None else None,
                      method=method,
                      headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urlopen(request, timeout=10) as response:
        return json.load(response) if response.status != 204 else None

# Users cannot edit their own branch through account management.
call('/users/profile', {'attributes': [
    {'name': 'username', 'permissions': {'view': ['admin', 'user'], 'edit': ['admin']}},
    {'name': 'email', 'permissions': {'view': ['admin', 'user'], 'edit': ['admin']}},
    {'name': 'firstName', 'permissions': {'view': ['admin', 'user'], 'edit': ['admin']}},
    {'name': 'lastName', 'permissions': {'view': ['admin', 'user'], 'edit': ['admin']}},
    {'name': 'branch_id', 'permissions': {'view': ['admin', 'user'], 'edit': ['admin']}}
]}, 'PUT')
for name in ('officer-one', 'officer-two', 'manager-one', 'admin-one'):
    users = call('/users?' + urlencode({'username': name, 'exact': 'true'}))
    if len(users) != 1:
        raise RuntimeError('Expected one sample staff account for ' + name)
    call('/users/' + users[0]['id'] + '/reset-password',
         {'type': 'password', 'value': values['STAFF_PASSWORD'], 'temporary': False}, 'PUT')
print('Four local sample accounts are ready. Passwords stay in infra/compose/.env.')
