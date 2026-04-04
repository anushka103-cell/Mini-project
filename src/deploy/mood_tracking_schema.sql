-- MindSafe Mood Tracking Schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS mood_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    logged_date DATE NOT NULL,
    mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
    mood_label VARCHAR(32),
    notes TEXT,
    emotion_scores JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_id ON mood_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_logs_logged_date ON mood_logs(logged_date);
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, logged_date);

-- Optional trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mood_logs_updated_at ON mood_logs;
CREATE TRIGGER trg_mood_logs_updated_at
BEFORE UPDATE ON mood_logs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
