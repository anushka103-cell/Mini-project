let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

const TOKEN_BUFFER_MS = 60000;

function parseExpiresInToMs(expiresIn) {
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn)) {
    return Math.max(0, expiresIn) * 1000;
  }

  if (typeof expiresIn === "string") {
    const value = expiresIn.trim();
    const match = value.match(/^(\d+)([smh]?)$/i);
    if (match) {
      const amount = Number(match[1]);
      const unit = (match[2] || "s").toLowerCase();
      if (unit === "h") return amount * 60 * 60 * 1000;
      if (unit === "m") return amount * 60 * 1000;
      return amount * 1000;
    }
  }

  return 15 * 60 * 1000;
}

function getStorageKey(name) {
  return `mindsafe_${name}`;
}

function saveTokens(accessToken, refreshToken, expiresIn) {
  const expiresAtMs = Date.now() + parseExpiresInToMs(expiresIn);

  tokenCache = { accessToken, refreshToken, expiresAt: expiresAtMs };

  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(getStorageKey("accessToken"), accessToken || "");
    localStorage.setItem(getStorageKey("refreshToken"), refreshToken || "");
    localStorage.setItem(getStorageKey("expiresAt"), String(expiresAtMs));
  }
}

function loadTokens() {
  if (tokenCache.accessToken) {
    return tokenCache;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return { accessToken: null, refreshToken: null, expiresAt: null };
  }

  const accessToken = localStorage.getItem(getStorageKey("accessToken"));
  const refreshToken = localStorage.getItem(getStorageKey("refreshToken"));
  const expiresAt =
    Number(localStorage.getItem(getStorageKey("expiresAt"))) || null;

  tokenCache = {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    expiresAt,
  };

  return tokenCache;
}

function clearTokens() {
  tokenCache = { accessToken: null, refreshToken: null, expiresAt: null };

  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.removeItem(getStorageKey("accessToken"));
    localStorage.removeItem(getStorageKey("refreshToken"));
    localStorage.removeItem(getStorageKey("expiresAt"));
  }
}

function isTokenExpired() {
  const { expiresAt } = loadTokens();
  if (!expiresAt) return true;
  return Date.now() + TOKEN_BUFFER_MS >= expiresAt;
}

async function refreshAccessToken(apiBaseUrl) {
  const { refreshToken } = loadTokens();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.accessToken) {
      saveTokens(
        data.accessToken,
        data.refreshToken || refreshToken,
        data.expiresIn,
      );
      return data.accessToken;
    }

    return null;
  } catch {
    return null;
  }
}

async function getValidAccessToken(apiBaseUrl) {
  const { accessToken } = loadTokens();

  if (accessToken && !isTokenExpired()) {
    return accessToken;
  }

  // Try to refresh the token
  const refreshed = await refreshAccessToken(apiBaseUrl);
  if (refreshed) return refreshed;

  // If refresh failed but we still have an access token, return it anyway.
  // The server will validate the JWT and return 401 if truly expired.
  if (accessToken) return accessToken;

  return null;
}

async function fetchWithAuth(
  url,
  options = {},
  apiBaseUrl = "http://localhost:5000",
) {
  const token = await getValidAccessToken(apiBaseUrl);

  if (!token) {
    // Return a synthetic 401 instead of throwing so pages handle it uniformly
    return new Response(JSON.stringify({ message: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const newToken = await refreshAccessToken(apiBaseUrl);

    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    }
    // If refresh failed, just return the original 401 — don't throw
  }

  return response;
}

function hasValidSession() {
  const { accessToken, refreshToken } = loadTokens();
  if (accessToken && !isTokenExpired()) {
    return true;
  }

  // Allow protected routes to load when a refresh token exists;
  // fetchWithAuth can renew the access token on first request.
  return Boolean(refreshToken);
}

function getSessionDebugState() {
  const { accessToken, refreshToken, expiresAt } = loadTokens();
  const now = Date.now();
  const msUntilExpiry = expiresAt ? expiresAt - now : null;

  return {
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    expiresAt,
    msUntilExpiry,
    isExpired: expiresAt ? msUntilExpiry <= 0 : true,
  };
}

export {
  saveTokens,
  loadTokens,
  clearTokens,
  isTokenExpired,
  getValidAccessToken,
  refreshAccessToken,
  fetchWithAuth,
  hasValidSession,
  getSessionDebugState,
};
