const { DATA_ENCRYPTION_KEY, DATA_HMAC_KEY } = require("../config/env");
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

const encryptionKey = deriveKey(DATA_ENCRYPTION_KEY, "field-encryption");
const digestKey = deriveKey(DATA_HMAC_KEY, "lookup-digests");

const state = {
  users: new Map(),
  emailIndex: new Map(),
  chats: new Map(),
  moods: new Map(),
  avatars: new Map(),
  profiles: new Map(),
  sessions: new Map(),
};

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function emailDigest(email) {
  return hashValue(normalizeEmail(email), digestKey);
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
    analyticsSubjectId: record.analyticsSubjectId,
    email: decryptString(record.emailEnvelope, encryptionKey),
    passwordHash: record.passwordHashEnvelope
      ? decryptString(record.passwordHashEnvelope, encryptionKey)
      : null,
    isVerified: record.isVerified,
    provider: record.provider,
    googleId: record.googleIdEnvelope
      ? decryptString(record.googleIdEnvelope, encryptionKey)
      : null,
    role: record.role,
    tokenVersion: record.tokenVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    privacy: record.privacy,
  };
}

function getUsers() {
  return Array.from(state.users.values(), mapUserRecord);
}

function findUserById(userId) {
  return mapUserRecord(state.users.get(userId));
}

function findUserByEmail(email) {
  const userId = state.emailIndex.get(emailDigest(email));
  return userId ? findUserById(userId) : null;
}

function addUser(user) {
  const id = user.id || generateOpaqueId("usr");
  const normalizedEmail = normalizeEmail(user.email);
  const now = new Date().toISOString();
  const record = {
    id,
    analyticsSubjectId:
      user.analyticsSubjectId || createAnonymousId(id, digestKey, "subject"),
    emailDigest: emailDigest(normalizedEmail),
    emailEnvelope: encryptString(normalizedEmail, encryptionKey),
    passwordHashEnvelope: user.passwordHash
      ? encryptString(user.passwordHash, encryptionKey)
      : null,
    isVerified: Boolean(user.isVerified),
    provider: user.provider || "local",
    googleIdEnvelope: user.googleId
      ? encryptString(String(user.googleId), encryptionKey)
      : null,
    role: user.role || "user",
    tokenVersion: user.tokenVersion || 1,
    createdAt: user.createdAt || now,
    updatedAt: now,
    privacy: {
      consentPolicy: "hipaa-like-minimum-necessary-v1",
      encryptedAtRest: true,
      anonymizedSubjectIds: true,
      auditReady: true,
    },
  };

  state.users.set(id, record);
  state.emailIndex.set(record.emailDigest, id);
  return mapUserRecord(record);
}

function updateUser(userId, patch) {
  const record = state.users.get(userId);
  if (!record) {
    return null;
  }

  if (patch.email !== undefined) {
    state.emailIndex.delete(record.emailDigest);
    const normalizedEmail = normalizeEmail(patch.email);
    record.emailDigest = emailDigest(normalizedEmail);
    record.emailEnvelope = encryptString(normalizedEmail, encryptionKey);
    state.emailIndex.set(record.emailDigest, userId);
  }

  if (patch.passwordHash !== undefined) {
    record.passwordHashEnvelope = patch.passwordHash
      ? encryptString(patch.passwordHash, encryptionKey)
      : null;
  }

  if (patch.googleId !== undefined) {
    record.googleIdEnvelope = patch.googleId
      ? encryptString(String(patch.googleId), encryptionKey)
      : null;
  }

  if (patch.isVerified !== undefined) {
    record.isVerified = Boolean(patch.isVerified);
  }

  if (patch.provider !== undefined) {
    record.provider = patch.provider;
  }

  if (patch.role !== undefined) {
    record.role = patch.role;
  }

  if (patch.tokenVersion !== undefined) {
    record.tokenVersion = patch.tokenVersion;
  }

  record.updatedAt = new Date().toISOString();
  return mapUserRecord(record);
}

function createSession({ userId, refreshTokenHash, ipAddress, userAgent }) {
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

  state.sessions.set(session.id, session);
  return { ...session };
}

function getSession(sessionId) {
  const session = state.sessions.get(sessionId);
  return session ? { ...session } : null;
}

function updateSession(sessionId, patch) {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return null;
  }

  Object.assign(session, patch, { lastSeenAt: new Date().toISOString() });
  return { ...session };
}

function revokeSession(sessionId) {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return null;
  }

  session.revokedAt = new Date().toISOString();
  session.lastSeenAt = session.revokedAt;
  return { ...session };
}

function deleteUserById(userId) {
  const user = state.users.get(userId);
  if (user) {
    state.emailIndex.delete(user.emailDigest);
  }

  state.users.delete(userId);
  state.chats.delete(userId);
  state.moods.delete(userId);
  state.avatars.delete(userId);
  state.profiles.delete(userId);

  for (const [sessionId, session] of state.sessions.entries()) {
    if (session.userId === userId) {
      state.sessions.delete(sessionId);
    }
  }
}

function getUserChats(userId) {
  return (state.chats.get(userId) || []).map(decodeStoredValue);
}

function addChatMessage(userId, message) {
  const messages = state.chats.get(userId) || [];
  messages.push(encodeStoredValue(message));
  state.chats.set(userId, messages);
}

function getUserMoods(userId) {
  return (state.moods.get(userId) || []).map(decodeStoredValue);
}

function addMoodEntry(userId, entry) {
  const entries = state.moods.get(userId) || [];
  entries.push(encodeStoredValue(entry));
  state.moods.set(userId, entries);
}

function getUserAvatar(userId) {
  return decodeStoredValue(state.avatars.get(userId));
}

function setUserAvatar(userId, avatar3D) {
  const payload = { avatar3D };
  state.avatars.set(userId, encodeStoredValue(payload));
  return decodeStoredValue(state.avatars.get(userId));
}

function getUserProfile(userId) {
  return (
    decodeStoredValue(state.profiles.get(userId)) || {
      anonymousName: "Anonymous",
      anonymousMode: true,
    }
  );
}

function upsertUserProfile(userId, patch) {
  const profile = {
    ...getUserProfile(userId),
    ...patch,
  };

  state.profiles.set(userId, encodeStoredValue(profile));
  return decodeStoredValue(state.profiles.get(userId));
}

module.exports = {
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
};
