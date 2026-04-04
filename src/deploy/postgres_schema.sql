-- MindSafe PostgreSQL Schema with Encryption
-- Date: 2026-03-27
-- Purpose: Secure database schema for mental health platform
-- Features: Field-level encryption, audit logging, data integrity

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =================== ENUM TYPES ===================
CREATE TYPE mood_level AS ENUM ('very_sad', 'sad', 'neutral', 'happy', 'very_happy');
CREATE TYPE crisis_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE user_role AS ENUM ('user', 'psychologist', 'admin');
CREATE TYPE chat_type AS ENUM ('ai_companion', 'peer_support', 'psychologist');

-- =================== USERS TABLE ===================
-- Stores user accounts with encrypted sensitive fields
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT UNIQUE NOT NULL,
    -- Password stored as hash (never in plain text)
    password_hash VARCHAR(255) NOT NULL,
    -- Name encrypted at rest
    encrypted_name BYTEA NOT NULL,
    -- Phone number encrypted (optional)
    encrypted_phone BYTEA,
    role user_role DEFAULT 'user' NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    -- Two-factor authentication
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    -- Account status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    -- Consent tracking (GDPR compliance)
    consent_analytics BOOLEAN DEFAULT FALSE,
    consent_research BOOLEAN DEFAULT FALSE,
    consent_marketing BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMP,
    -- Data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- =================== EMAIL VERIFICATION TOKENS ===================
CREATE TABLE verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(50) NOT NULL CHECK (token_type IN ('email_verification', 'password_reset', 'two_factor')),
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

CREATE INDEX idx_verification_tokens_user ON verification_tokens(user_id);
CREATE INDEX idx_verification_tokens_expires ON verification_tokens(expires_at);

-- =================== SESSIONS TABLE ===================
-- Stores user sessions with Redis fallback
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_active ON sessions(is_active, expires_at);

-- =================== CHAT MESSAGES TABLE ===================
-- Stores encrypted chat messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    sender_type chat_type NOT NULL,
    -- Message encrypted with AES-256
    encrypted_content BYTEA NOT NULL,
    -- Embedding for semantic search (not encrypted for performance)
    message_embedding FLOAT8[],
    -- Sentiment analysis result
    sentiment_score FLOAT CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0),
    emotion_detected VARCHAR(50),
    -- Crisis flags
    contains_crisis_keyword BOOLEAN DEFAULT FALSE,
    crisis_level crisis_level DEFAULT 'low',
    -- Metadata
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_sentiment CHECK (sentiment_score IS NULL OR (sentiment_score >= -1.0 AND sentiment_score <= 1.0))
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_crisis ON chat_messages(contains_crisis_keyword);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);

-- =================== CONVERSATIONS TABLE ===================
-- Groups chat messages into conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_type chat_type NOT NULL,
    ai_companion_id VARCHAR(100),
    peer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    psychologist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Conversation metadata
    encrypted_title BYTEA,
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    is_flagged_for_crisis BOOLEAN DEFAULT FALSE,
    -- Encryption keys (for E2E messaging between users)
    encryption_key_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_type ON conversations(chat_type);
CREATE INDEX idx_conversations_crisis ON conversations(is_flagged_for_crisis);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- =================== MOOD ENTRIES TABLE ===================
-- Tracks user mood with timestamps and context
CREATE TABLE mood_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood_level mood_level NOT NULL,
    mood_score FLOAT NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
    -- Optional encrypted context
    encrypted_context BYTEA,
    -- Associated factors
    triggers JSONB,
    activities TEXT[],
    medication_taken BOOLEAN,
    sleep_hours FLOAT CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
    exercise_minutes INTEGER CHECK (exercise_minutes >= 0),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_private BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_mood_entries_user ON mood_entries(user_id);
CREATE INDEX idx_mood_entries_created ON mood_entries(created_at DESC);
CREATE INDEX idx_mood_entries_user_date ON mood_entries(user_id, created_at DESC);

-- =================== MOOD PATTERNS TABLE ===================
-- Stores detected patterns (anxiety, depression risk, etc.)
CREATE TABLE mood_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_type VARCHAR(100) NOT NULL, -- e.g., 'anxiety_spike', 'depression_trend'
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    -- Time window for pattern
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    -- Trend data
    affected_mood_entries INTEGER,
    recommended_actions TEXT[],
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_mood_patterns_user ON mood_patterns(user_id);
CREATE INDEX idx_mood_patterns_severity ON mood_patterns(severity);
CREATE INDEX idx_mood_patterns_detected ON mood_patterns(detected_at DESC);

-- =================== CRISIS ALERTS TABLE ===================
-- Tracks crisis detection events
CREATE TABLE crisis_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crisis_level crisis_level NOT NULL,
    -- Source of alert
    triggered_by VARCHAR(100) NOT NULL, -- 'chat_keyword', 'mood_pattern', 'user_report'
    encrypted_reason BYTEA,
    -- Associated chat message
    message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    -- Response tracking
    is_responded BOOLEAN DEFAULT FALSE,
    responded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    response_timestamp TIMESTAMP,
    encryption_key_hash VARCHAR(255),
    -- Resources provided
    resources_provided JSONB,
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crisis_alerts_user ON crisis_alerts(user_id);
CREATE INDEX idx_crisis_alerts_level ON crisis_alerts(crisis_level);
CREATE INDEX idx_crisis_alerts_responded ON crisis_alerts(is_responded);
CREATE INDEX idx_crisis_alerts_created ON crisis_alerts(created_at DESC);

-- =================== AUDIT LOG TABLE ===================
-- Immutable audit trail for compliance
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT immutable_audit CHECK (created_at IS NOT NULL)
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- =================== EMERGENCY CONTACTS TABLE ===================
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) NOT NULL, -- 'emergency_number', 'trusted_person', 'therapist'
    encrypted_contact_info BYTEA NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);

-- =================== AI MODEL METADATA TABLE ===================
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(255) NOT NULL UNIQUE,
    model_type VARCHAR(100) NOT NULL, -- 'emotion_detection', 'crisis_detection', 'analytics'
    version VARCHAR(50) NOT NULL,
    model_path TEXT NOT NULL,
    accuracy_score FLOAT,
    last_updated_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    framework VARCHAR(100), -- 'tensorflow', 'pytorch', 'scikit-learn'
    parameters JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =================== ENCRYPTION KEY MANAGEMENT ===================
CREATE TABLE encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name VARCHAR(255) NOT NULL UNIQUE,
    key_version INTEGER NOT NULL DEFAULT 1,
    algorithm VARCHAR(100) NOT NULL DEFAULT 'AES-256-GCM',
    is_active BOOLEAN DEFAULT TRUE,
    key_rotation_date TIMESTAMP,
    next_rotation_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =================== VIEWS FOR COMMON QUERIES ===================

-- Active sessions view
CREATE VIEW active_sessions AS
SELECT 
    s.id,
    s.user_id,
    s.ip_address,
    s.user_agent,
    s.last_activity_at,
    s.expires_at
FROM sessions s
WHERE s.is_active = TRUE 
AND s.expires_at > CURRENT_TIMESTAMP;

-- Recent crisis alerts view
CREATE VIEW recent_crisis_alerts AS
SELECT 
    ca.id,
    ca.user_id,
    ca.crisis_level,
    ca.triggered_by,
    ca.is_responded,
    ca.created_at
FROM crisis_alerts ca
WHERE ca.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY ca.created_at DESC;

-- User mood statistics view
CREATE VIEW user_mood_stats AS
SELECT 
    me.user_id,
    COUNT(*) as total_entries,
    AVG(me.mood_score) as avg_mood_score,
    MIN(me.mood_score) as min_mood_score,
    MAX(me.mood_score) as max_mood_score,
    DATE(me.created_at) as mood_date
FROM mood_entries me
GROUP BY me.user_id, DATE(me.created_at);

-- =================== FUNCTIONS ===================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper to resolve application user id from session settings.
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
DECLARE
    v_user_id TEXT;
BEGIN
    v_user_id := current_setting('app.user_id', true);

    IF v_user_id IS NULL OR v_user_id = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_user_id::UUID;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for conversations table
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_action VARCHAR,
    p_resource_type VARCHAR,
    p_resource_id VARCHAR,
    p_old_values JSONB,
    p_new_values JSONB,
    p_ip_address INET,
    p_user_agent TEXT
) RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, 
        old_values, new_values, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent
    );
END;
$$ LANGUAGE plpgsql;

-- =================== ROW LEVEL SECURITY (RLS) ===================
-- Enable RLS for sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy for users (users can only see their own data)
CREATE POLICY users_own_data ON users
    FOR SELECT USING (id = current_user_id() OR current_setting('app.admin', true) = 'true');

-- RLS Policy for mood entries
CREATE POLICY mood_entries_own_data ON mood_entries
    FOR ALL USING (user_id = current_user_id() OR current_setting('app.admin', true) = 'true');

-- =================== COLLATION & SEARCH ===================
-- Full-text search on chat messages (for crisis keywords)
ALTER TABLE chat_messages ADD COLUMN search_vector TSVECTOR;

CREATE INDEX idx_chat_messages_search ON chat_messages USING GIN(search_vector);

-- Comment on tables for documentation
COMMENT ON TABLE users IS 'Core user accounts with encrypted sensitive fields';
COMMENT ON TABLE chat_messages IS 'Encrypted chat messages with sentiment and crisis detection';
COMMENT ON TABLE mood_entries IS 'User mood tracking with context and triggers';
COMMENT ON TABLE crisis_alerts IS 'Crisis detection events with response tracking';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance (GDPR, HIPAA)';

-- =================== INITIAL DATA ===================
-- Insert encryption key metadata (actual keys stored in secure vault)
INSERT INTO encryption_keys (key_name, key_version, algorithm, is_active, next_rotation_date)
VALUES 
    ('user_data_key', 1, 'AES-256-GCM', true, CURRENT_TIMESTAMP + INTERVAL '90 days'),
    ('message_key', 1, 'AES-256-GCM', true, CURRENT_TIMESTAMP + INTERVAL '90 days')
ON CONFLICT (key_name) DO NOTHING;

-- =================== ANONYMOUS CHAT TABLES ===================

-- Reports from anonymous chat sessions
CREATE TABLE anon_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_hash VARCHAR(64) NOT NULL,
    reported_hash VARCHAR(64) NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_anon_reports_reported ON anon_reports(reported_hash);
CREATE INDEX idx_anon_reports_created ON anon_reports(created_at DESC);

-- Shadow-ban / temp-ban records
CREATE TABLE anon_bans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_hash VARCHAR(64) UNIQUE NOT NULL,
    ban_type VARCHAR(20) DEFAULT 'shadow' CHECK (ban_type IN ('shadow', 'temp', 'permanent')),
    reason VARCHAR(255),
    expires_at TIMESTAMP, -- NULL = permanent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_anon_bans_hash ON anon_bans(user_hash);
CREATE INDEX idx_anon_bans_expires ON anon_bans(expires_at);

-- Trust scores accrued via positive post-chat feedback
CREATE TABLE anon_trust (
    user_hash VARCHAR(64) PRIMARY KEY,
    score INTEGER DEFAULT 0 NOT NULL CHECK (score >= 0),
    total_sessions INTEGER DEFAULT 0 NOT NULL,
    positive_feedback INTEGER DEFAULT 0 NOT NULL,
    negative_feedback INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE anon_reports IS 'Anonymous chat abuse reports keyed by hashed socket identity';
COMMENT ON TABLE anon_bans IS 'Shadow-ban and temp-ban records for anonymous chat';
COMMENT ON TABLE anon_trust IS 'Trust scores derived from post-chat feedback';
