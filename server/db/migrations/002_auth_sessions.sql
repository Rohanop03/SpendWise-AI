CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_rotated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_auth_sessions_refresh_token_hash UNIQUE (refresh_token_hash),
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_auth_sessions_refresh_token_hash
    CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_auth_sessions_expiry
    CHECK (expires_at > created_at),
  CONSTRAINT chk_auth_sessions_revocation
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CONSTRAINT chk_auth_sessions_rotation
    CHECK (last_rotated_at >= created_at)
);

CREATE INDEX idx_auth_sessions_user_active
  ON auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_sessions_expiry
  ON auth_sessions (expires_at)
  WHERE revoked_at IS NULL;
