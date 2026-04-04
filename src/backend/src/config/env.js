const NODE_ENV = process.env.NODE_ENV || "development";
const DEFAULT_JWT_SECRET =
  "development-only-jwt-secret-change-before-production-please";
const DEFAULT_ENCRYPTION_KEY =
  "development-only-data-encryption-key-change-before-production";
const DEFAULT_HMAC_KEY =
  "development-only-data-hmac-key-change-before-production-123";

function readSecret(name, fallback) {
  const value = process.env[name] || fallback;

  if (NODE_ENV === "production" && (!process.env[name] || value === fallback || value.length < 32)) {
    console.warn(`WARNING: ${name} is missing or too short for production. Using fallback.`);
  }

  return value;
}

const JWT_SECRET = readSecret("JWT_SECRET", DEFAULT_JWT_SECRET);
const JWT_REFRESH_SECRET = readSecret(
  "JWT_REFRESH_SECRET",
  `${JWT_SECRET}:refresh`,
);
const JWT_EMAIL_VERIFICATION_SECRET = readSecret(
  "JWT_EMAIL_VERIFICATION_SECRET",
  `${JWT_SECRET}:verify-email`,
);
const DATA_ENCRYPTION_KEY = readSecret(
  "DATA_ENCRYPTION_KEY",
  DEFAULT_ENCRYPTION_KEY,
);
const DATA_HMAC_KEY = readSecret("DATA_HMAC_KEY", DEFAULT_HMAC_KEY);
const JWT_ISSUER = process.env.JWT_ISSUER || "mindsafe-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "mindsafe-clients";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";
const EMAIL_VERIFICATION_TTL = process.env.EMAIL_VERIFICATION_TTL || "1h";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const PORT = Number(process.env.PORT || 5000);
const FRONTEND_ORIGIN = process.env.CORS_ORIGINS || "http://localhost:3000";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:5000/api/auth/google/callback";
const CHATBOT_SERVICE_URL =
  process.env.CHATBOT_SERVICE_URL || "http://localhost:8004";
const MOOD_ANALYTICS_URL =
  process.env.MOOD_ANALYTICS_URL || "http://localhost:8002";
const RECOMMENDATION_SERVICE_URL =
  process.env.RECOMMENDATION_SERVICE_URL || "http://localhost:8005";
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost/mindsafe";
const USE_POSTGRES = process.env.USE_POSTGRES === "true";
const JWT_PASSWORD_RESET_SECRET = readSecret(
  "JWT_PASSWORD_RESET_SECRET",
  `${JWT_SECRET}:password-reset`,
);
const PASSWORD_RESET_TTL = process.env.PASSWORD_RESET_TTL || "1h";

module.exports = {
  NODE_ENV,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EMAIL_VERIFICATION_SECRET,
  JWT_PASSWORD_RESET_SECRET,
  DATA_ENCRYPTION_KEY,
  DATA_HMAC_KEY,
  JWT_ISSUER,
  JWT_AUDIENCE,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  EMAIL_VERIFICATION_TTL,
  PASSWORD_RESET_TTL,
  BCRYPT_ROUNDS,
  PORT,
  FRONTEND_ORIGIN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  CHATBOT_SERVICE_URL,
  MOOD_ANALYTICS_URL,
  RECOMMENDATION_SERVICE_URL,
  DB_URL,
  USE_POSTGRES,
};
