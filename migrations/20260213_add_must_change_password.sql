-- Add must_change_password to users (safe, idempotent)
BEGIN;

-- Add column if it doesn't exist, default false to avoid breaking behaviour
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;

-- Verification (optional):
-- SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='must_change_password';
