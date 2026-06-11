-- 008_password_reset.sql
-- Stores one-time tokens for password reset emails.
-- Tokens expire after 1 hour and are deleted after use.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hex of the raw token
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,                    -- set when token is consumed
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by token hash
CREATE INDEX idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);

-- Index for cleanup job (delete expired tokens)
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
