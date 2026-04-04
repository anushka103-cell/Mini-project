const RECONNECT_PREFIX = "mindsafe:anon:reconnect:";
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

let redis = null;

/**
 * Initialise with an ioredis client instance.
 * Must be called before any other method.
 */
function init(redisClient) {
  redis = redisClient;
}

/**
 * Store a reconnect code with the two participant hashes.
 * Redis TTL handles expiration — no manual cleanup needed.
 */
async function set(code, hashA, hashB) {
  if (!redis) return;
  const value = JSON.stringify({ hashA, hashB });
  await redis.set(RECONNECT_PREFIX + code, value, "EX", TTL_SECONDS);
}

/**
 * Retrieve a reconnect code's data.
 * Returns { hashA, hashB } or null if expired / not found.
 */
async function get(code) {
  if (!redis) return null;
  const raw = await redis.get(RECONNECT_PREFIX + code);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Delete a used reconnect code.
 */
async function del(code) {
  if (!redis) return;
  await redis.del(RECONNECT_PREFIX + code);
}

module.exports = { init, set, get, del };
