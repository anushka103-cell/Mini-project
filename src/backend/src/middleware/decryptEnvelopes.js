/**
 * Middleware to decrypt client-side encrypted envelopes
 * Automatically detects and decrypts encrypted fields in request body
 */

const {
  isClientEncryptedEnvelope,
  decryptClientEnvelope,
} = require("../utils/crypto");

/**
 * Create middleware to decrypt client-encrypted envelopes in request body
 * @param {Object} userStore - User data store to fetch user details
 * @returns {Function} - Express middleware
 */
function createDecryptEnvelopeMiddleware(userStore) {
  return async (req, res, next) => {
    try {
      // Only process POST/PUT requests with JSON body
      if (!["POST", "PUT"].includes(req.method) || !req.body) {
        return next();
      }

      // Extract user ID from request (set by auth middleware)
      const userId = req.user?.id || req.user?.sub;
      if (!userId) {
        // Continue without decryption if user not found
        return next();
      }

      // Recursively decrypt encrypted envelopes
      req.body = decryptEnvelopesInObject(req.body, userId);

      next();
    } catch (err) {
      console.error("Error decrypting envelopes:", err);
      // Continue to endpoint - let the endpoint handle any decryption errors
      next();
    }
  };
}

/**
 * Recursively process an object and decrypt any client-encrypted envelopes
 * @param {*} obj - Object to process
 * @param {string} keyMaterial - User ID for key derivation
 * @returns {*} - Object with decrypted envelopes
 */
function decryptEnvelopesInObject(obj, keyMaterial) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => decryptEnvelopesInObject(item, keyMaterial));
  }

  // If the entire object is an encrypted envelope, decrypt it
  if (isClientEncryptedEnvelope(obj)) {
    try {
      const decrypted = decryptClientEnvelope(obj, keyMaterial);
      // Try to parse as JSON; if fails, return as string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (err) {
      console.error("Failed to decrypt envelope:", err);
      return obj; // Return original if decryption fails
    }
  }

  // Recursively process object properties
  const decrypted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isClientEncryptedEnvelope(value)) {
      try {
        const plaintext = decryptClientEnvelope(value, keyMaterial);
        // Store as string; controller can parse if needed
        decrypted[key] = plaintext;
      } catch (err) {
        console.error(`Failed to decrypt field '${key}':`, err);
        decrypted[key] = value; // Keep encrypted if decryption fails
      }
    } else if (typeof value === "object" && value !== null) {
      decrypted[key] = decryptEnvelopesInObject(value, keyMaterial);
    } else {
      decrypted[key] = value;
    }
  }

  return decrypted;
}

module.exports = {
  createDecryptEnvelopeMiddleware,
  decryptEnvelopesInObject,
};
