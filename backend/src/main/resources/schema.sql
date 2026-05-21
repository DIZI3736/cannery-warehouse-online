CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    actor_name VARCHAR(255),
    actor_role VARCHAR(50),
    product_id BIGINT,
    product_name VARCHAR(255),
    action_type VARCHAR(50),
    field_name VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    description TEXT
);
