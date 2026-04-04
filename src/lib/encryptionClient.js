/**
 * Client-side encryption library for MindSafe
 * Uses Web Crypto API for AES-256-GCM encryption
 * Mirrors backend crypto operations for end-to-end encrypted envelope
 */

/**
 * Derive a 256-bit key from base material using PBKDF2
 * @param {string|ArrayBuffer} baseMaterial - User session ID or other stable material
 * @param {string} context - Context string (e.g., "mindsafe:chat", "mindsafe:mood")
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(baseMaterial, context) {
  const salt = new TextEncoder().encode(context);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    typeof baseMaterial === "string"
      ? new TextEncoder().encode(baseMaterial)
      : baseMaterial,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a string value using AES-256-GCM
 * @param {string} plaintext - Text to encrypt
 * @param {CryptoKey} key - Derived encryption key
 * @returns {Promise<{iv: string, ciphertext: string, tag: string, alg: string}>}
 */
async function encryptString(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData,
  );

  // In Web Crypto, the tag is included in the encrypted output
  // Split: ciphertext is the encrypted output, tag is the last 16 bytes
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, -16);
  const tag = encryptedArray.slice(-16);

  return {
    alg: "aes-256-gcm",
    iv: bufferToBase64Url(iv),
    ciphertext: bufferToBase64Url(ciphertext),
    tag: bufferToBase64Url(tag),
  };
}

/**
 * Decrypt a string that was encrypted with encryptString
 * @param {Object} payload - { iv, ciphertext, tag, alg }
 * @param {CryptoKey} key - Derived encryption key
 * @returns {Promise<string>} - Decrypted plaintext
 */
async function decryptString(payload, key) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Encrypted payload is missing");
  }

  const iv = base64UrlToBuffer(payload.iv);
  const ciphertext = base64UrlToBuffer(payload.ciphertext);
  const tag = base64UrlToBuffer(payload.tag);

  // Reconstruct the full encrypted data (ciphertext + tag)
  const encryptedData = new Uint8Array(ciphertext.length + tag.length);
  encryptedData.set(ciphertext, 0);
  encryptedData.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt a JSON object
 * @param {Object} data - Object to encrypt
 * @param {CryptoKey} key - Derived encryption key
 * @returns {Promise<{iv: string, ciphertext: string, tag: string, alg: string, encrypted: true}>}
 */
async function encryptJson(data, key) {
  const plaintext = JSON.stringify(data);
  const encrypted = await encryptString(plaintext, key);
  return { ...encrypted, encrypted: true };
}

/**
 * Decrypt a JSON object
 * @param {Object} payload - Encrypted envelope
 * @param {CryptoKey} key - Derived encryption key
 * @returns {Promise<Object>} - Decrypted object
 */
async function decryptJson(payload, key) {
  const plaintext = await decryptString(payload, key);
  return JSON.parse(plaintext);
}

/**
 * Create an encrypted envelope for a sensitive field
 * @param {string} value - Field value to encrypt
 * @param {CryptoKey} key - Derived encryption key
 * @param {string} context - Context string for reference (optional)
 * @returns {Promise<{encrypted: true, iv: string, ciphertext: string, tag: string, alg: string, context?: string}>}
 */
async function createEncryptedEnvelope(value, key, context) {
  const encrypted = await encryptString(String(value), key);
  const envelope = { ...encrypted, encrypted: true };
  if (context) {
    envelope.context = context;
  }
  return envelope;
}

/**
 * Convert ArrayBuffer to base64url string (no padding)
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Convert base64url string back to ArrayBuffer
 * @param {string} base64url
 * @returns {Uint8Array}
 */
function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(paddingLength);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Get encryption key from auth session
 * Uses the user's anonymized ID as the basis for key derivation
 * @param {string} context - Encryption context
 * @returns {Promise<CryptoKey>}
 */
async function getEncryptionKey(context = "mindsafe") {
  try {
    // Try to get from authClient cache if available
    const { loadTokens } = await import("./authClient");
    const tokens = loadTokens();

    if (!tokens || !tokens.accessToken) {
      throw new Error("No valid session");
    }

    // Decode JWT to get anonymized user ID
    const headerEnd = tokens.accessToken.indexOf(".");
    const payloadStart = headerEnd + 1;
    const payloadEnd = tokens.accessToken.indexOf(".", payloadStart);
    const payload = tokens.accessToken.substring(payloadStart, payloadEnd);

    // Add padding if needed
    let decoded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (decoded.length % 4)) % 4;
    decoded += "=".repeat(padLength);

    const decoded_obj = JSON.parse(atob(decoded));
    const userId = decoded_obj.sub || decoded_obj.id;

    if (!userId) {
      throw new Error("Cannot extract user ID from token");
    }

    return deriveKey(userId, context);
  } catch (err) {
    console.error("Error deriving encryption key:", err);
    throw err;
  }
}

export {
  deriveKey,
  encryptString,
  decryptString,
  encryptJson,
  decryptJson,
  createEncryptedEnvelope,
  getEncryptionKey,
};
