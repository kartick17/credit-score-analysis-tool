CREATE TABLE audit_entries (
    id uuid PRIMARY KEY,
    actor_id varchar(200) NOT NULL,
    action varchar(80) NOT NULL,
    resource_id uuid,
    outcome varchar(30) NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now()
);
