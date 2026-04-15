const DEFAULT_API_BASE_URL = "https://mindsafe-api.onrender.com";
const DEFAULT_WS_URL = "wss://mindsafe-api.onrender.com";
const DEFAULT_GOOGLE_AUTH_URL = `${DEFAULT_API_BASE_URL}/api/auth/google`;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL;
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WS_URL;
export const GOOGLE_AUTH_URL =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL || DEFAULT_GOOGLE_AUTH_URL;

export default {
  API_BASE_URL,
  WS_URL,
  GOOGLE_AUTH_URL,
};
