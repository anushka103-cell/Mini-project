const bcrypt = require("bcryptjs");
const { Resend } = require("resend");
const { DATA_HMAC_KEY, BCRYPT_ROUNDS, NODE_ENV } = require("../config/env");
const { deriveKey, hashValue } = require("../utils/crypto");
const userStore = require("../repositories");

const sessionHashKey = deriveKey(DATA_HMAC_KEY, "session-token-hash");
const mobileOtpStore = new Map();
const loginAttemptStore = new Map();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const STORE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_STORE_SIZE = 10000;

// Periodic cleanup of expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of mobileOtpStore) {
    if (value.expiresAt < now) mobileOtpStore.delete(key);
  }
  for (const [key, value] of loginAttemptStore) {
    if (now - value.lastAttempt > LOCKOUT_DURATION_MS)
      loginAttemptStore.delete(key);
  }
}, STORE_CLEANUP_INTERVAL_MS).unref();

function normalizeMobile(rawMobile) {
  return String(rawMobile || "")
    .trim()
    .replace(/[\s()-]/g, "");
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createAuthService({
  tokenService,
  resendApiKey,
  appUrl,
  emailFrom,
  smsProvider,
}) {
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const senderAddress = emailFrom || "MindSafe <onboarding@resend.dev>";

  function hashRefreshToken(token) {
    return hashValue(token, sessionHashKey);
  }

  function hashOtp(otp) {
    return hashValue(otp, sessionHashKey);
  }

  async function findUserByMobile(mobile) {
    const normalizedMobile = normalizeMobile(mobile);
    if (!normalizedMobile) {
      return null;
    }

    const users = await userStore.getUsers();

    for (const user of users) {
      const profile = await userStore.getUserProfile(user.id);
      if (!profile) {
        continue;
      }

      if (normalizeMobile(profile.mobile) === normalizedMobile) {
        return { user, profile };
      }
    }

    return null;
  }

  async function createSessionTokens(user, metadata, existingSessionId) {
    const session = existingSessionId
      ? await userStore.getSession(existingSessionId)
      : await userStore.createSession({
          userId: user.id,
          refreshTokenHash: null,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        });

    const accessToken = tokenService.issueAccessToken(user, session.id);
    const refreshToken = tokenService.issueRefreshToken(user, session.id);

    await userStore.updateSession(session.id, {
      refreshTokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    });

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      expiresIn: "15m",
      anonymizedUserId: user.id,
      analyticsSubjectId: user.analyticsSubjectId,
    };
  }

  async function register({ email, password }) {
    if (!email || !password) {
      return {
        status: 400,
        body: { message: "Email and password are required" },
      };
    }

    const existingUser = await userStore.findUserByEmail(email);
    if (existingUser) {
      return { status: 400, body: { message: "User already exists" } };
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Auto-verify accounts when no email provider is configured,
    // otherwise email verification is required.
    const autoVerify = !resend;

    const newUser = await userStore.addUser({
      email: normalizedEmail,
      passwordHash: hashedPassword,
      isVerified: autoVerify,
      provider: "local",
      role: "user",
    });

    const verificationToken = tokenService.issueEmailVerificationToken(
      newUser.id,
    );

    const verificationLink = `${appUrl}/verify-email?token=${verificationToken}`;

    if (resend) {
      try {
        await resend.emails.send({
          from: senderAddress,
          to: normalizedEmail,
          subject: "Verify your MindSafe account",
          html: `
          <h2>Welcome to MindSafe</h2>
          <p>Please verify your email to activate your account.</p>
          <p>
            <a href="${verificationLink}">Click here to verify your email</a>
          </p>
        `,
        });
      } catch (error) {
        console.error("Email error:", error);
        return {
          status: 500,
          body: { message: "Failed to send verification email" },
        };
      }
    } else {
      console.warn("RESEND_API_KEY not set; skipping verification email send.");
    }

    return {
      status: 201,
      body: {
        message:
          "Registration successful. Please check your email to verify your account.",
        anonymizedUserId: newUser.id,
        // In development, return the token/link to make local verification testable.
        ...(NODE_ENV === "development"
          ? {
              emailVerificationToken: verificationToken,
              verificationLink,
            }
          : {}),
      },
    };
  }

  async function verifyEmail(token) {
    if (!token) {
      return { status: 400, body: { message: "Verification token missing" } };
    }

    try {
      const decoded = tokenService.verifyEmailVerificationToken(token);
      const user = await userStore.findUserById(decoded.sub);

      if (!user) {
        return { status: 400, body: { message: "Invalid verification token" } };
      }

      if (!user.isVerified) {
        await userStore.updateUser(user.id, { isVerified: true });
      }

      return { status: 200, body: { message: "Email verified successfully" } };
    } catch (error) {
      return { status: 400, body: { message: "Invalid or expired token" } };
    }
  }

  async function requestEmailVerification(userId) {
    const user = await userStore.findUserById(userId);
    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }

    if (user.isVerified) {
      return { status: 200, body: { message: "Email already verified" } };
    }

    const verificationToken = tokenService.issueEmailVerificationToken(user.id);
    const verificationLink = `${appUrl}/verify-email?token=${verificationToken}`;

    if (resend) {
      try {
        await resend.emails.send({
          from: senderAddress,
          to: user.email,
          subject: "Verify your MindSafe account",
          html: `
            <h2>Verify your MindSafe account</h2>
            <p>Click the link below to verify your email.</p>
            <p><a href="${verificationLink}">Verify email</a></p>
          `,
        });
      } catch (error) {
        console.error("Email error:", error);
        return {
          status: 500,
          body: { message: "Failed to send verification email" },
        };
      }
    }

    return {
      status: 200,
      body: {
        message: "Verification email sent",
        ...(NODE_ENV === "development"
          ? { emailVerificationToken: verificationToken, verificationLink }
          : {}),
      },
    };
  }

  async function requestMobileOtp({ mobile }) {
    const normalizedMobile = normalizeMobile(mobile);
    const userMatch = await findUserByMobile(normalizedMobile);

    if (!userMatch) {
      return {
        status: 200,
        body: {
          message: "If this mobile number is registered, an OTP has been sent.",
          ...(NODE_ENV === "development"
            ? {
                debug:
                  "No user profile is linked to this mobile. Save this mobile in Profile first, then request OTP again.",
              }
            : {}),
        },
      };
    }

    const otp = generateOtp();
    mobileOtpStore.set(normalizedMobile, {
      otpHash: hashOtp(otp),
      userId: userMatch.user.id,
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    // Send OTP via configured SMS provider
    if (smsProvider) {
      try {
        const result = await smsProvider.sendOtp(normalizedMobile, otp);
        if (!result.delivered) {
          console.error("SMS delivery failed:", result.error);
        }
      } catch (err) {
        console.error("SMS provider error:", err);
      }
    }

    return {
      status: 200,
      body: {
        message: "OTP sent successfully.",
        ...(NODE_ENV === "development" ? { otp } : {}),
      },
    };
  }

  async function loginWithMobileOtp({ mobile, otp, metadata }) {
    const normalizedMobile = normalizeMobile(mobile);
    const otpRecord = mobileOtpStore.get(normalizedMobile);

    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return { status: 400, body: { message: "OTP expired or invalid" } };
    }

    if (otpRecord.otpHash !== hashOtp(String(otp || ""))) {
      return { status: 400, body: { message: "Invalid OTP" } };
    }

    const user = await userStore.findUserById(otpRecord.userId);
    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }

    const existingProfile = await userStore.getUserProfile(user.id);
    await userStore.upsertUserProfile(user.id, {
      ...existingProfile,
      mobile: normalizedMobile,
      isMobileVerified: true,
      mobileVerifiedAt: new Date().toISOString(),
    });

    mobileOtpStore.delete(normalizedMobile);

    const tokens = await createSessionTokens(user, metadata);
    return {
      status: 200,
      body: {
        ...tokens,
        role: user.role,
      },
    };
  }

  async function verifyMobileOtp({ userId, mobile, otp }) {
    const normalizedMobile = normalizeMobile(mobile);
    const otpRecord = mobileOtpStore.get(normalizedMobile);

    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return { status: 400, body: { message: "OTP expired or invalid" } };
    }

    if (otpRecord.userId !== userId) {
      return { status: 403, body: { message: "OTP does not match user" } };
    }

    if (otpRecord.otpHash !== hashOtp(String(otp || ""))) {
      return { status: 400, body: { message: "Invalid OTP" } };
    }

    const existingProfile = await userStore.getUserProfile(userId);
    await userStore.upsertUserProfile(userId, {
      ...existingProfile,
      mobile: normalizedMobile,
      isMobileVerified: true,
      mobileVerifiedAt: new Date().toISOString(),
    });

    mobileOtpStore.delete(normalizedMobile);

    return { status: 200, body: { message: "Mobile verified successfully" } };
  }

  async function login({ email, password, metadata }) {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    // Check account lockout
    const attempts = loginAttemptStore.get(normalizedEmail);
    if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const elapsed = Date.now() - attempts.lastAttempt;
      if (elapsed < LOCKOUT_DURATION_MS) {
        const remainingMin = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 60000);
        return {
          status: 429,
          body: {
            message: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
          },
        };
      }
      // Lockout expired, reset
      loginAttemptStore.delete(normalizedEmail);
    }

    const user = await userStore.findUserByEmail(email);
    if (!user) {
      recordFailedAttempt(normalizedEmail);
      return { status: 400, body: { message: "Invalid credentials" } };
    }

    if (!user.isVerified) {
      return {
        status: 403,
        body: { message: "Verify your email before signing in" },
      };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash || "");
    if (!isMatch) {
      recordFailedAttempt(normalizedEmail);
      return { status: 400, body: { message: "Invalid credentials" } };
    }

    // Successful login — clear failed attempts
    loginAttemptStore.delete(normalizedEmail);

    const tokens = await createSessionTokens(user, metadata);

    return {
      status: 200,
      body: {
        ...tokens,
        role: user.role,
      },
    };
  }

  function recordFailedAttempt(email) {
    const existing = loginAttemptStore.get(email) || { count: 0 };
    loginAttemptStore.set(email, {
      count: existing.count + 1,
      lastAttempt: Date.now(),
    });
  }

  async function refreshSession({ refreshToken, metadata }) {
    if (!refreshToken) {
      return { status: 400, body: { message: "refreshToken is required" } };
    }

    try {
      const decoded = tokenService.verifyRefreshToken(refreshToken);
      const user = await userStore.findUserById(decoded.sub);
      const session = await userStore.getSession(decoded.sid);

      if (
        !user ||
        !session ||
        session.userId !== user.id ||
        session.revokedAt
      ) {
        return { status: 401, body: { message: "Session is invalid" } };
      }

      if (session.refreshTokenHash !== hashRefreshToken(refreshToken)) {
        await userStore.revokeSession(session.id);
        return {
          status: 401,
          body: { message: "Refresh token has been rotated" },
        };
      }

      await userStore.updateSession(session.id, {
        ipHash: metadata?.ipAddress
          ? hashValue(metadata.ipAddress, sessionHashKey)
          : session.ipHash,
        userAgentHash: metadata?.userAgent
          ? hashValue(metadata.userAgent, sessionHashKey)
          : session.userAgentHash,
      });

      return {
        status: 200,
        body: await createSessionTokens(user, metadata, session.id),
      };
    } catch (error) {
      return {
        status: 401,
        body: { message: "Invalid or expired refresh token" },
      };
    }
  }

  async function logout(sessionId) {
    if (!sessionId) {
      return { status: 400, body: { message: "No active session" } };
    }

    await userStore.revokeSession(sessionId);
    return { status: 200, body: { message: "Signed out successfully" } };
  }

  async function loginWithGoogleProfile({ email, googleId, name, metadata }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    let user = await userStore.findUserByEmail(normalizedEmail);

    if (!user) {
      user = await userStore.addUser({
        email: normalizedEmail,
        passwordHash: null,
        isVerified: true,
        provider: "google",
        googleId,
        role: "user",
      });
    } else {
      user = await userStore.updateUser(user.id, {
        googleId,
        isVerified: true,
        provider: user.provider === "local" ? "hybrid" : "google",
      });
    }

    // Save Google profile name if the user profile doesn't have one yet
    if (name && typeof name === "string" && name.trim()) {
      try {
        const profile = (await userStore.getUserProfile(user.id)) || {};
        if (!profile.fullName || !profile.fullName.trim()) {
          await userStore.upsertUserProfile(user.id, {
            ...profile,
            fullName: name.trim(),
          });
        }
      } catch {
        // Non-critical — continue even if profile save fails
      }
    }

    return createSessionTokens(user, metadata);
  }

  async function forgotPassword({ email }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userStore.findUserByEmail(normalizedEmail);

    // Always return success to prevent email enumeration
    const successResponse = {
      status: 200,
      body: {
        message:
          "If an account with that email exists, a password reset link has been sent.",
      },
    };

    if (!user) {
      return successResponse;
    }

    if (user.provider === "google") {
      return successResponse;
    }

    const resetToken = tokenService.issuePasswordResetToken(user.id);
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

    if (resend) {
      try {
        await resend.emails.send({
          from: senderAddress,
          to: normalizedEmail,
          subject: "Reset your MindSafe password",
          html: `
            <h2>Password Reset</h2>
            <p>You requested a password reset. Click the link below to set a new password.</p>
            <p><a href="${resetLink}">Reset your password</a></p>
            <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          `,
        });
      } catch (error) {
        console.error("Password reset email error:", error);
        return {
          status: 500,
          body: { message: "Failed to send password reset email" },
        };
      }
    } else {
      console.warn(
        "RESEND_API_KEY not set; skipping password reset email send.",
      );
    }

    return {
      ...successResponse,
      body: {
        ...successResponse.body,
        // In dev, expose token for testing
        ...(NODE_ENV === "development" ? { resetToken, resetLink } : {}),
      },
    };
  }

  async function resetPassword({ token, password }) {
    if (!token || !password) {
      return {
        status: 400,
        body: { message: "Token and new password are required" },
      };
    }

    try {
      const decoded = tokenService.verifyPasswordResetToken(token);
      const user = await userStore.findUserById(decoded.sub);

      if (!user) {
        return {
          status: 400,
          body: { message: "Invalid or expired reset token" },
        };
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await userStore.updateUser(user.id, {
        passwordHash: hashedPassword,
        tokenVersion: (user.tokenVersion || 0) + 1,
      });

      return {
        status: 200,
        body: {
          message:
            "Password reset successfully. Please log in with your new password.",
        },
      };
    } catch {
      return {
        status: 400,
        body: { message: "Invalid or expired reset token" },
      };
    }
  }

  return {
    register,
    verifyEmail,
    requestEmailVerification,
    login,
    requestMobileOtp,
    loginWithMobileOtp,
    verifyMobileOtp,
    refreshSession,
    logout,
    loginWithGoogleProfile,
    forgotPassword,
    resetPassword,
  };
}

module.exports = {
  createAuthService,
};
