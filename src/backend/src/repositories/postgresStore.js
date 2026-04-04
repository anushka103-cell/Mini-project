/**
 * PostgreSQL encrypted repository for MindSafe
 * Implements the same interface as memoryStore but with persistent PostgreSQL storage
 * All sensitive data is encrypted at rest using the same encryption model
 */

const { Pool } = require("pg");
const { DATA_ENCRYPTION_KEY, DATA_HMAC_KEY, DB_URL } = require("../config/env");
const {
  deriveKey,
  encryptString,
  decryptString,
  encryptJson,
  decryptJson,
  hashValue,
  generateOpaqueId,
  createAnonymousId,
  isClientEncryptedEnvelope,
} = require("../utils/crypto");

// Initialize encryption keys
const encryptionKey = deriveKey(DATA_ENCRYPTION_KEY, "field-encryption");
const digestKey = deriveKey(DATA_HMAC_KEY, "lookup-digests");

const TABLES = {
  users: "app_users",
  sessions: "app_sessions",
  chatMessages: "app_chat_messages",
  moodEntries: "app_mood_entries",
  avatars: "app_avatars",
  profiles: "app_profiles",
};

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Track connection
pool.on("error", (err) => {
  console.error("Unexpected pool error:", err);
});

/**
 * Initialize database schema
 */
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create necessary tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.users} (
        id TEXT PRIMARY KEY,
        analytics_subject_id TEXT NOT NULL UNIQUE,
        email_digest TEXT NOT NULL UNIQUE,
        email_envelope BYTEA NOT NULL,
        password_hash_envelope BYTEA,
        is_verified BOOLEAN DEFAULT FALSE,
        provider TEXT DEFAULT 'local',
        google_id_envelope BYTEA,
        role TEXT DEFAULT 'user',
        token_version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        privacy JSONB
      );

      CREATE TABLE IF NOT EXISTS ${TABLES.sessions} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES ${TABLES.users}(id) ON DELETE CASCADE,
        refresh_token_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP,
        ip_hash TEXT,
        user_agent_hash TEXT
      );

      CREATE TABLE IF NOT EXISTS ${TABLES.chatMessages} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES ${TABLES.users}(id) ON DELETE CASCADE,
        message_data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ${TABLES.moodEntries} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES ${TABLES.users}(id) ON DELETE CASCADE,
        mood_data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ${TABLES.avatars} (
        user_id TEXT PRIMARY KEY REFERENCES ${TABLES.users}(id) ON DELETE CASCADE,
        avatar_data BYTEA NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ${TABLES.profiles} (
        user_id TEXT PRIMARY KEY REFERENCES ${TABLES.users}(id) ON DELETE CASCADE,
        profile_data BYTEA NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_app_users_email_digest ON ${TABLES.users}(email_digest);
      CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON ${TABLES.sessions}(user_id);
      CREATE INDEX IF NOT EXISTS idx_app_chat_user ON ${TABLES.chatMessages}(user_id);
      CREATE INDEX IF NOT EXISTS idx_app_mood_user ON ${TABLES.moodEntries}(user_id);

      ALTER TABLE ${TABLES.sessions}
      ALTER COLUMN refresh_token_hash DROP NOT NULL;
    `);

    console.log("Database schema initialized");
  } catch (err) {
    console.error("Error initializing database:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Utility functions
 */
function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function emailDigest(email) {
  return hashValue(normalizeEmail(email), digestKey);
}

function encodeBinaryPayload(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function decodeBinaryPayload(value) {
  if (!value) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return JSON.parse(value.toString("utf8"));
  }

  if (typeof value === "string") {
    return JSON.parse(value);
  }

  return value;
}

function encodeStoredValue(value) {
  if (isClientEncryptedEnvelope(value)) {
    return {
      storageMode: "client-e2ee",
      value,
    };
  }

  return {
    storageMode: "server-encrypted",
    value: encryptJson(value, encryptionKey),
  };
}

function decodeStoredValue(value) {
  if (!value) {
    return null;
  }

  if (value.storageMode === "client-e2ee") {
    return value.value;
  }

  return decryptJson(value.value, encryptionKey);
}

function mapUserRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    analyticsSubjectId: record.analytics_subject_id,
    email: decryptString(
      decodeBinaryPayload(record.email_envelope),
      encryptionKey,
    ),
    passwordHash: record.password_hash_envelope
      ? decryptString(
          decodeBinaryPayload(record.password_hash_envelope),
          encryptionKey,
        )
      : null,
    isVerified: record.is_verified,
    provider: record.provider,
    googleId: record.google_id_envelope
      ? decryptString(
          decodeBinaryPayload(record.google_id_envelope),
          encryptionKey,
        )
      : null,
    role: record.role,
    tokenVersion: record.token_version,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
    privacy: record.privacy,
  };
}

/**
 * User operations
 */
async function getUsers() {
  const result = await pool.query(`SELECT * FROM ${TABLES.users}`);
  return result.rows.map(mapUserRecord);
}

async function findUserById(userId) {
  const result = await pool.query(
    `SELECT * FROM ${TABLES.users} WHERE id = $1`,
    [userId],
  );
  return result.rows.length > 0 ? mapUserRecord(result.rows[0]) : null;
}

async function findUserByEmail(email) {
  const digest = emailDigest(email);
  const result = await pool.query(
    `SELECT * FROM ${TABLES.users} WHERE email_digest = $1`,
    [digest],
  );
  return result.rows.length > 0 ? mapUserRecord(result.rows[0]) : null;
}

async function addUser(user) {
  const id = user.id || generateOpaqueId("usr");
  const normalizedEmail = normalizeEmail(user.email);
  const now = new Date().toISOString();

  const result = await pool.query(
    `INSERT INTO ${TABLES.users} (
      id, analytics_subject_id, email_digest, email_envelope,
      password_hash_envelope, is_verified, provider, google_id_envelope,
      role, token_version, created_at, updated_at, privacy
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      id,
      user.analyticsSubjectId || createAnonymousId(id, digestKey, "subject"),
      emailDigest(normalizedEmail),
      encodeBinaryPayload(encryptString(normalizedEmail, encryptionKey)),
      user.passwordHash
        ? encodeBinaryPayload(encryptString(user.passwordHash, encryptionKey))
        : null,
      Boolean(user.isVerified),
      user.provider || "local",
      user.googleId
        ? encodeBinaryPayload(
            encryptString(String(user.googleId), encryptionKey),
          )
        : null,
      user.role || "user",
      user.tokenVersion || 1,
      now,
      now,
      JSON.stringify({
        consentPolicy: "hipaa-like-minimum-necessary-v1",
        encryptedAtRest: true,
        anonymizedSubjectIds: true,
        auditReady: true,
      }),
    ],
  );

  return mapUserRecord(result.rows[0]);
}

async function updateUser(userId, patch) {
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  const updates = { updated_at: new Date().toISOString() };
  const values = [];
  const setClauses = [];
  let paramCount = 1;

  if (patch.email !== undefined) {
    const normalizedEmail = normalizeEmail(patch.email);
    setClauses.push(`email_digest = $${paramCount++}`);
    values.push(emailDigest(normalizedEmail));
    setClauses.push(`email_envelope = $${paramCount++}`);
    values.push(
      encodeBinaryPayload(encryptString(normalizedEmail, encryptionKey)),
    );
  }

  if (patch.passwordHash !== undefined) {
    setClauses.push(`password_hash_envelope = $${paramCount++}`);
    values.push(
      patch.passwordHash
        ? encodeBinaryPayload(encryptString(patch.passwordHash, encryptionKey))
        : null,
    );
  }

  if (patch.googleId !== undefined) {
    setClauses.push(`google_id_envelope = $${paramCount++}`);
    values.push(
      patch.googleId
        ? encodeBinaryPayload(
            encryptString(String(patch.googleId), encryptionKey),
          )
        : null,
    );
  }

  if (patch.isVerified !== undefined) {
    setClauses.push(`is_verified = $${paramCount++}`);
    values.push(Boolean(patch.isVerified));
  }

  if (patch.provider !== undefined) {
    setClauses.push(`provider = $${paramCount++}`);
    values.push(patch.provider);
  }

  if (patch.role !== undefined) {
    setClauses.push(`role = $${paramCount++}`);
    values.push(patch.role);
  }

  if (patch.tokenVersion !== undefined) {
    setClauses.push(`token_version = $${paramCount++}`);
    values.push(patch.tokenVersion);
  }

  setClauses.push(`updated_at = $${paramCount++}`);
  values.push(updates.updated_at);

  values.push(userId);

  const result = await pool.query(
    `UPDATE ${TABLES.users} SET ${setClauses.join(", ")} WHERE id = $${paramCount} RETURNING *`,
    values,
  );

  return result.rows.length > 0 ? mapUserRecord(result.rows[0]) : null;
}

/**
 * Session operations
 */
async function createSession({
  userId,
  refreshTokenHash,
  ipAddress,
  userAgent,
}) {
  const session = {
    id: generateOpaqueId("ses"),
    userId,
    refreshTokenHash,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    revokedAt: null,
    ipHash: ipAddress ? hashValue(ipAddress, digestKey) : null,
    userAgentHash: userAgent ? hashValue(userAgent, digestKey) : null,
  };

  await pool.query(
    `INSERT INTO ${TABLES.sessions} (id, user_id, refresh_token_hash, created_at, last_seen_at, revoked_at, ip_hash, user_agent_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      session.id,
      userId,
      refreshTokenHash,
      session.createdAt,
      session.lastSeenAt,
      session.revokedAt,
      session.ipHash,
      session.userAgentHash,
    ],
  );

  return { ...session };
}

async function getSession(sessionId) {
  const result = await pool.query(
    `SELECT * FROM ${TABLES.sessions} WHERE id = $1`,
    [sessionId],
  );
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    ipHash: row.ip_hash,
    userAgentHash: row.user_agent_hash,
  };
}

async function updateSession(sessionId, patch) {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const updates = { ...patch, lastSeenAt: new Date().toISOString() };
  const setClauses = [];
  const values = [];
  let paramCount = 1;

  if (patch.revokedAt !== undefined) {
    setClauses.push(`revoked_at = $${paramCount++}`);
    values.push(patch.revokedAt);
  }

  if (patch.refreshTokenHash !== undefined) {
    setClauses.push(`refresh_token_hash = $${paramCount++}`);
    values.push(patch.refreshTokenHash);
  }

  if (patch.ipHash !== undefined) {
    setClauses.push(`ip_hash = $${paramCount++}`);
    values.push(patch.ipHash);
  }

  if (patch.userAgentHash !== undefined) {
    setClauses.push(`user_agent_hash = $${paramCount++}`);
    values.push(patch.userAgentHash);
  }

  setClauses.push(`last_seen_at = $${paramCount++}`);
  values.push(updates.lastSeenAt);
  values.push(sessionId);

  await pool.query(
    `UPDATE ${TABLES.sessions} SET ${setClauses.join(", ")} WHERE id = $${paramCount}`,
    values,
  );

  return { ...session, ...updates };
}

async function revokeSession(sessionId) {
  const now = new Date().toISOString();
  return updateSession(sessionId, { revokedAt: now });
}

/**
 * Chat operations
 */
async function getUserChats(userId) {
  const result = await pool.query(
    `SELECT message_data FROM ${TABLES.chatMessages} WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );

  return result.rows.map((row) => {
    const stored = decodeBinaryPayload(row.message_data);
    return decodeStoredValue(stored);
  });
}

async function addChatMessage(userId, message) {
  const messageData = encodeStoredValue(message);
  const messageId = generateOpaqueId("msg");
  await pool.query(
    `INSERT INTO ${TABLES.chatMessages} (id, user_id, message_data, created_at)
     VALUES ($1, $2, $3, $4)`,
    [
      messageId,
      userId,
      encodeBinaryPayload(messageData),
      new Date().toISOString(),
    ],
  );

  return messageId;
}

/**
 * Mood operations
 */
async function getUserMoods(userId) {
  const result = await pool.query(
    `SELECT mood_data FROM ${TABLES.moodEntries} WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );

  return result.rows.map((row) => {
    const stored = decodeBinaryPayload(row.mood_data);
    return decodeStoredValue(stored);
  });
}

async function addMoodEntry(userId, entry) {
  const entryData = encodeStoredValue(entry);
  const moodEntryId = generateOpaqueId("mood");
  await pool.query(
    `INSERT INTO ${TABLES.moodEntries} (id, user_id, mood_data, created_at)
     VALUES ($1, $2, $3, $4)`,
    [
      moodEntryId,
      userId,
      encodeBinaryPayload(entryData),
      new Date().toISOString(),
    ],
  );

  return moodEntryId;
}

/**
 * Avatar operations
 */
async function getUserAvatar(userId) {
  const result = await pool.query(
    `SELECT avatar_data FROM ${TABLES.avatars} WHERE user_id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const stored = decodeBinaryPayload(result.rows[0].avatar_data);
  return decodeStoredValue(stored);
}

async function setUserAvatar(userId, avatar3D) {
  const payload = { avatar3D };
  const avatarData = encodeStoredValue(payload);

  await pool.query(
    `INSERT INTO ${TABLES.avatars} (user_id, avatar_data, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET avatar_data = EXCLUDED.avatar_data, updated_at = EXCLUDED.updated_at`,
    [userId, encodeBinaryPayload(avatarData), new Date().toISOString()],
  );

  return decodeStoredValue(avatarData);
}

/**
 * Profile operations
 */
async function getUserProfile(userId) {
  const result = await pool.query(
    `SELECT profile_data FROM ${TABLES.profiles} WHERE user_id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      anonymousName: "Anonymous",
      anonymousMode: true,
    };
  }

  const stored = decodeBinaryPayload(result.rows[0].profile_data);
  return decodeStoredValue(stored);
}

async function upsertUserProfile(userId, patch) {
  const profile = {
    ...(await getUserProfile(userId)),
    ...patch,
  };

  const profileData = encodeStoredValue(profile);

  await pool.query(
    `INSERT INTO ${TABLES.profiles} (user_id, profile_data, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET profile_data = EXCLUDED.profile_data, updated_at = EXCLUDED.updated_at`,
    [userId, encodeBinaryPayload(profileData), new Date().toISOString()],
  );

  return decodeStoredValue(profileData);
}

/**
 * Cleanup
 */
async function deleteUserById(userId) {
  // Cascade delete will handle all related records due to foreign keys
  await pool.query(`DELETE FROM ${TABLES.users} WHERE id = $1`, [userId]);
}

/**
 * Health check and cleanup
 */
async function close() {
  await pool.end();
}

module.exports = {
  initializeDatabase,
  getUsers,
  findUserById,
  findUserByEmail,
  addUser,
  updateUser,
  createSession,
  getSession,
  updateSession,
  revokeSession,
  deleteUserById,
  getUserChats,
  addChatMessage,
  getUserMoods,
  addMoodEntry,
  getUserAvatar,
  setUserAvatar,
  getUserProfile,
  upsertUserProfile,
  close,
};
