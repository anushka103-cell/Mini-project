// Safety filters for anonymous chat messages
// PII detection, content filtering, crisis keyword quick-check, rate limiting

const {
  PII_PATTERNS,
  BLOCKED_CONTENT,
  CRISIS_KEYWORDS_QUICK,
} = require("./anonConstants");

/**
 * Check message for PII (phone, email, social handles, URLs, SSN).
 * Returns { hasPII, types[] } — does NOT block, just flags.
 */
function detectPII(text) {
  const found = [];
  for (const { name, pattern } of PII_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      found.push(name);
    }
  }
  return { hasPII: found.length > 0, types: found };
}

/**
 * Mask PII in a message so it can still be sent but with redacted info.
 */
function maskPII(text) {
  let masked = text;
  for (const { name, pattern } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    masked = masked.replace(pattern, `[${name} hidden]`);
  }
  return masked;
}

/**
 * Check against blocked content list.
 * Returns { isBlocked, matchedTerm }
 */
function checkBlockedContent(text) {
  const lower = text.toLowerCase();
  for (const term of BLOCKED_CONTENT) {
    if (lower.includes(term)) {
      return { isBlocked: true, matchedTerm: term };
    }
  }
  return { isBlocked: false, matchedTerm: null };
}

/**
 * Quick crisis keyword scan (runs in Node, no HTTP call).
 * Returns { isCrisis, matchedKeywords[] }
 */
function quickCrisisCheck(text) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const kw of CRISIS_KEYWORDS_QUICK) {
    if (lower.includes(kw)) {
      matched.push(kw);
    }
  }
  return { isCrisis: matched.length > 0, matchedKeywords: matched };
}

/**
 * In-memory rate limiter per socket.
 * Tracks message timestamps in a sliding window.
 */
class RateLimiter {
  constructor({ maxMessages = 20, windowMs = 60000 } = {}) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
    // Map<socketId, number[]>  (timestamps)
    this.buckets = new Map();
  }

  /**
   * Returns true if the message should be allowed, false if rate-limited.
   */
  allow(socketId) {
    const now = Date.now();
    let timestamps = this.buckets.get(socketId);
    if (!timestamps) {
      timestamps = [];
      this.buckets.set(socketId, timestamps);
    }

    // Prune old entries
    while (timestamps.length > 0 && timestamps[0] < now - this.windowMs) {
      timestamps.shift();
    }

    if (timestamps.length >= this.maxMessages) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  clear(socketId) {
    this.buckets.delete(socketId);
  }
}

/**
 * Run all safety checks on a message.
 * Returns { allowed, reason, filtered, crisisDetected, piiDetected }
 */
function runSafetyChecks(text, socketId, rateLimiter) {
  // 1. Rate limit
  if (!rateLimiter.allow(socketId)) {
    return {
      allowed: false,
      reason: "rate_limited",
      filtered: text,
      crisisDetected: false,
      piiDetected: false,
    };
  }

  // 2. Blocked content
  const blocked = checkBlockedContent(text);
  if (blocked.isBlocked) {
    return {
      allowed: false,
      reason: "blocked_content",
      filtered: text,
      crisisDetected: false,
      piiDetected: false,
    };
  }

  // 3. PII detection — mask but allow
  const pii = detectPII(text);
  const filtered = pii.hasPII ? maskPII(text) : text;

  // 4. Crisis check
  const crisis = quickCrisisCheck(text);

  return {
    allowed: true,
    reason: null,
    filtered,
    crisisDetected: crisis.isCrisis,
    piiDetected: pii.hasPII,
    piiTypes: pii.types,
    crisisKeywords: crisis.matchedKeywords,
  };
}

module.exports = {
  detectPII,
  maskPII,
  checkBlockedContent,
  quickCrisisCheck,
  RateLimiter,
  runSafetyChecks,
};
