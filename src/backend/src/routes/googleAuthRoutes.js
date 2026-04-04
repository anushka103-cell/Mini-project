const express = require("express");
const { randomBytes } = require("crypto");

// Short-lived store for OAuth state tokens (CSRF protection)
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function createGoogleAuthRoutes({
  authService,
  googleClientId,
  googleClientSecret,
  googleCallbackUrl,
  frontendOrigin,
}) {
  const router = express.Router();

  // Step 1 — redirect browser to Google's consent screen
  router.get("/auth/google", (req, res) => {
    if (!googleClientId || googleClientId.startsWith("your-google")) {
      return res.status(503).json({
        message:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
      });
    }

    // Generate a random state token to prevent CSRF
    const state = randomBytes(32).toString("hex");
    pendingStates.set(state, Date.now() + STATE_TTL_MS);

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleCallbackUrl,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Step 2 — Google redirects back here with ?code=&state=
  router.get("/auth/google/callback", async (req, res) => {
    const { code, error, state } = req.query;

    if (error || !code) {
      return res.redirect(
        `${frontendOrigin}/login?error=${encodeURIComponent("You cancelled the Google sign-in.")}`,
      );
    }

    // Validate state to prevent CSRF attacks
    const stateExpiry = pendingStates.get(state);
    pendingStates.delete(state);

    if (!stateExpiry || Date.now() > stateExpiry) {
      return res.redirect(
        `${frontendOrigin}/login?error=${encodeURIComponent("Google sign-in session expired or was tampered with. Please try again.")}`,
      );
    }

    try {
      // Exchange authorization code for access token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: googleCallbackUrl,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        console.error("Google token exchange failed:", tokenData);
        return res.redirect(
          `${frontendOrigin}/login?error=${encodeURIComponent("Google could not verify your account. Please try again.")}`,
        );
      }

      // Fetch user profile from Google
      const userRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      const userInfo = await userRes.json();

      if (!userInfo.email) {
        return res.redirect(
          `${frontendOrigin}/login?error=${encodeURIComponent("Your Google account did not share an email address.")}`,
        );
      }

      const tokens = await authService.loginWithGoogleProfile({
        email: userInfo.email,
        googleId: userInfo.id,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "unknown",
        },
      });

      // Redirect to frontend callback page with tokens
      const callbackParams = new URLSearchParams({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      res.redirect(`${frontendOrigin}/auth/callback?${callbackParams}`);
    } catch (err) {
      console.error("Google OAuth error:", err);
      res.redirect(
        `${frontendOrigin}/login?error=${encodeURIComponent("An unexpected error occurred with Google sign-in. Please try again.")}`,
      );
    }
  });

  return router;
}

module.exports = { createGoogleAuthRoutes };
