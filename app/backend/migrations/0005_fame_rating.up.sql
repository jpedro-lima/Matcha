ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS fame_rating INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_fame ON profiles(fame_rating DESC);
