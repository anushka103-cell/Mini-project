const crypto = require("crypto");

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const PBKDF2_ITERATIONS = 100000;

function deriveKey(secret, context) {
  return crypto.scryptSync(String(secret), `mindsafe:${context}`, 32);
}

/**
 * Derive key using PBKDF2 (used for client-encrypted data)
 * @param {string} baseMaterial - Base material for key derivation (e.g., user ID)
 * @param {string} context - Context string (e.g., "mindsafe:chat")
 * @returns {Buffer} - 32-byte encryption key
 */
function derivePbkdf2Key(baseMaterial, context) {
  const salt = Buffer.from(`${context}`);
  return crypto.pbkdf2Sync(
    String(baseMaterial),
    salt,
    PBKDF2_ITERATIONS,
    32,
    "sha256",
  );
}

function encryptString(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    alg: ENCRYPTION_ALGORITHM,
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function decryptString(payload, key) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Encrypted payload is missing");
  }

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/**
 * Decrypt client-side encrypted envelope using PBKDF2
 * @param {Object} payload - Client-encrypted envelope
 * @param {string} keyMaterial - Base material for key derivation
 * @returns {string} - Decrypted plaintext
 */
function decryptClientEnvelope(payload, keyMaterial) {
  if (!isClientEncryptedEnvelope(payload)) {
    throw new Error("Invalid client-encrypted envelope");
  }

  // Determine context from envelope or use default
  const context = payload.context || "mindsafe:default";
  const key = derivePbkdf2Key(keyMaterial, context);
  return decryptString(payload, key);
}

function encryptJson(value, key) {
  return encryptString(JSON.stringify(value), key);
}

function decryptJson(payload, key) {
  return JSON.parse(decryptString(payload, key));
}

function hashValue(value, key) {
  return crypto
    .createHmac("sha256", key)
    .update(String(value), "utf8")
    .digest("hex");
}

function generateOpaqueId(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

function createAnonymousId(value, key, prefix) {
  const digest = hashValue(value, key).slice(0, 32);
  return `${prefix}_${digest}`;
}

function createRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function isClientEncryptedEnvelope(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.encrypted === true &&
    typeof value.ciphertext === "string",
  );
}

module.exports = {
  deriveKey,
  derivePbkdf2Key,
  encryptString,
  decryptString,
  decryptClientEnvelope,
  encryptJson,
  decryptJson,
  hashValue,
  generateOpaqueId,
  createAnonymousId,
  createRandomToken,
  isClientEncryptedEnvelope,
};
