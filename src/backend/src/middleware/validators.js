const { sendError } = require("../utils/httpResponse");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^\+?\d{10,15}$/;
const PASSWORD_UPPER = /[A-Z]/;
const PASSWORD_LOWER = /[a-z]/;
const PASSWORD_DIGIT = /\d/;
const PASSWORD_SPECIAL = /[!@#$%^&*(),.?":{}|<>\[\]\-_+=~`\\/;']/;
const ALLOWED_CHAT_ROLES = new Set(["user", "ai", "assistant", "system"]);
const ALLOWED_MOODS = new Set([
  "happy",
  "sad",
  "anxious",
  "frustrated",
  "calm",
  "tired",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function failValidation(res, message, details) {
  return sendError(res, 400, message, details);
}

function isEncryptedEnvelope(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.encrypted === true &&
    typeof value.ciphertext === "string",
  );
}

function validateRegister(req, res, next) {
  const { email, password } = req.body || {};

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return failValidation(res, "Email and password are required");
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return failValidation(res, "Invalid email format");
  }

  if (password.length < 8) {
    return failValidation(res, "Password must be at least 8 characters long");
  }

  if (!PASSWORD_UPPER.test(password)) {
    return failValidation(
      res,
      "Password must contain at least one uppercase letter",
    );
  }

  if (!PASSWORD_LOWER.test(password)) {
    return failValidation(
      res,
      "Password must contain at least one lowercase letter",
    );
  }

  if (!PASSWORD_DIGIT.test(password)) {
    return failValidation(res, "Password must contain at least one number");
  }

  if (!PASSWORD_SPECIAL.test(password)) {
    return failValidation(
      res,
      "Password must contain at least one special character",
    );
  }

  return next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return failValidation(res, "Email and password are required");
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return failValidation(res, "Invalid email format");
  }

  return next();
}

function validateVerifyEmail(req, res, next) {
  const { token } = req.body || {};

  if (!isNonEmptyString(token)) {
    return failValidation(res, "Verification token missing");
  }

  if (token.trim().length < 16) {
    return failValidation(res, "Verification token is invalid");
  }

  return next();
}

function validateRequestMobileOtp(req, res, next) {
  const { mobile } = req.body || {};

  if (!isNonEmptyString(mobile)) {
    return failValidation(res, "mobile is required");
  }

  const normalizedMobile = mobile.trim().replace(/[\s()-]/g, "");
  if (!MOBILE_REGEX.test(normalizedMobile)) {
    return failValidation(
      res,
      "mobile must be a valid number with country code (10-15 digits)",
    );
  }

  req.body.mobile = normalizedMobile;
  return next();
}

function validateLoginWithOtp(req, res, next) {
  const { otp } = req.body || {};

  if (!isNonEmptyString(otp)) {
    return failValidation(res, "otp is required");
  }

  if (!/^\d{6}$/.test(otp.trim())) {
    return failValidation(res, "otp must be a 6-digit code");
  }

  req.body.otp = otp.trim();
  return validateRequestMobileOtp(req, res, next);
}

function validateRefreshToken(req, res, next) {
  const { refreshToken } = req.body || {};

  if (!isNonEmptyString(refreshToken)) {
    return failValidation(res, "refreshToken is required");
  }

  return next();
}

function validateChatMessage(req, res, next) {
  const { role, content, encryptedContent } = req.body || {};

  if (!isNonEmptyString(role)) {
    return failValidation(res, "role is required");
  }

  if (!isNonEmptyString(content) && !isEncryptedEnvelope(encryptedContent)) {
    return failValidation(res, "content or encryptedContent is required");
  }

  if (!ALLOWED_CHAT_ROLES.has(role.trim().toLowerCase())) {
    return failValidation(
      res,
      "role must be one of: user, ai, assistant, system",
    );
  }

  if (isNonEmptyString(content) && content.trim().length > 5000) {
    return failValidation(
      res,
      "content exceeds maximum length of 5000 characters",
    );
  }

  return next();
}

function validateMoodEntry(req, res, next) {
  const { mood, intensity } = req.body || {};

  if (!isNonEmptyString(mood)) {
    return failValidation(res, "mood is required");
  }

  if (!ALLOWED_MOODS.has(mood.trim().toLowerCase())) {
    return failValidation(
      res,
      "mood must be one of: Happy, Sad, Anxious, Frustrated, Calm, Tired",
    );
  }

  if (intensity !== undefined) {
    const asNumber = Number(intensity);
    if (!Number.isFinite(asNumber) || asNumber < 1 || asNumber > 10) {
      return failValidation(res, "intensity must be a number between 1 and 10");
    }
  }

  return next();
}

function validateAvatar(req, res, next) {
  const { avatar3D } = req.body || {};

  if (!isNonEmptyString(avatar3D)) {
    return failValidation(res, "avatar3D is required");
  }

  if (!isValidHttpUrl(avatar3D.trim())) {
    return failValidation(res, "avatar3D must be a valid http or https URL");
  }

  if (avatar3D.length > 2048) {
    return failValidation(
      res,
      "avatar3D exceeds maximum length of 2048 characters",
    );
  }

  return next();
}

function validateProfilePatch(req, res, next) {
  const payload = req.body || {};

  if (typeof payload !== "object" || Array.isArray(payload)) {
    return failValidation(res, "profile payload must be an object");
  }

  if (
    !isNonEmptyString(payload.fullName) ||
    payload.fullName.trim().length < 2 ||
    payload.fullName.trim().length > 100
  ) {
    return failValidation(
      res,
      "fullName is required and must be between 2 and 100 characters",
    );
  }

  if (
    !isNonEmptyString(payload.email) ||
    !EMAIL_REGEX.test(payload.email.trim())
  ) {
    return failValidation(res, "A valid email is required");
  }

  if (isNonEmptyString(payload.mobile)) {
    const normalizedMobile = payload.mobile.trim().replace(/[\s()-]/g, "");
    if (!MOBILE_REGEX.test(normalizedMobile)) {
      return failValidation(
        res,
        "mobile must be a valid number with country code (10-15 digits)",
      );
    }
    payload.mobile = normalizedMobile;
  }
  payload.fullName = payload.fullName.trim();
  payload.email = payload.email.trim().toLowerCase();

  if (
    payload.anonymousName !== undefined &&
    (!isNonEmptyString(payload.anonymousName) ||
      payload.anonymousName.trim().length > 80)
  ) {
    return failValidation(
      res,
      "anonymousName must be a non-empty string up to 80 characters",
    );
  }

  if (
    payload.anonymousMode !== undefined &&
    typeof payload.anonymousMode !== "boolean"
  ) {
    return failValidation(res, "anonymousMode must be a boolean");
  }

  return next();
}

function validateForgotPassword(req, res, next) {
  const { email } = req.body || {};

  if (!isNonEmptyString(email)) {
    return failValidation(res, "Email is required");
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return failValidation(res, "Invalid email format");
  }

  return next();
}

function validateResetPassword(req, res, next) {
  const { token, password } = req.body || {};

  if (!isNonEmptyString(token)) {
    return failValidation(res, "Reset token is required");
  }

  if (token.trim().length < 16) {
    return failValidation(res, "Reset token is invalid");
  }

  if (!isNonEmptyString(password)) {
    return failValidation(res, "New password is required");
  }

  if (password.length < 8) {
    return failValidation(res, "Password must be at least 8 characters long");
  }

  if (!PASSWORD_UPPER.test(password)) {
    return failValidation(
      res,
      "Password must contain at least one uppercase letter",
    );
  }

  if (!PASSWORD_LOWER.test(password)) {
    return failValidation(
      res,
      "Password must contain at least one lowercase letter",
    );
  }

  if (!PASSWORD_DIGIT.test(password)) {
    return failValidation(res, "Password must contain at least one number");
  }

  if (!PASSWORD_SPECIAL.test(password)) {
    return failValidation(
      res,
      "Password must contain at least one special character",
    );
  }

  return next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateVerifyEmail,
  validateRequestMobileOtp,
  validateLoginWithOtp,
  validateRefreshToken,
  validateChatMessage,
  validateMoodEntry,
  validateAvatar,
  validateProfilePatch,
  validateForgotPassword,
  validateResetPassword,
};
