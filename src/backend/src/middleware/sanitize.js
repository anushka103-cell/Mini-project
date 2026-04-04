/**
 * Recursively sanitize string values in an object to prevent XSS.
 * Strips HTML tags and trims whitespace from all string fields.
 */
function sanitizeValue(value) {
  if (typeof value === "string") {
    return value.replace(/<[^>]*>/g, "").trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    // Skip encrypted envelopes — they must not be modified
    if (value.encrypted === true && typeof value.ciphertext === "string") {
      return value;
    }
    const sanitized = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitizeValue(value[key]);
    }
    return sanitized;
  }
  return value;
}

function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeValue(req.params);
  }
  next();
}

module.exports = { sanitizeInput };
