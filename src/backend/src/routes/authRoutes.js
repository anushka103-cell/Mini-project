const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateVerifyEmail,
  validateRequestMobileOtp,
  validateLoginWithOtp,
  validateForgotPassword,
  validateResetPassword,
} = require("../middleware/validators");
const {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");

function createAuthRoutes(authController, verifyToken) {
  const router = express.Router();

  router.post(
    "/register",
    registerLimiter,
    validateRegister,
    asyncHandler(authController.register),
  );
  router.post(
    "/email/request-verification",
    verifyToken,
    asyncHandler(authController.requestEmailVerification),
  );
  router.post(
    "/verify-email",
    validateVerifyEmail,
    asyncHandler(authController.verifyEmail),
  );
  router.post(
    "/login",
    loginLimiter,
    validateLogin,
    asyncHandler(authController.login),
  );
  router.post(
    "/mobile/request-otp",
    otpLimiter,
    validateRequestMobileOtp,
    asyncHandler(authController.requestMobileOtp),
  );
  router.post(
    "/mobile/login-otp",
    otpLimiter,
    validateLoginWithOtp,
    asyncHandler(authController.loginWithMobileOtp),
  );
  router.post(
    "/mobile/verify-otp",
    verifyToken,
    validateLoginWithOtp,
    asyncHandler(authController.verifyMobileOtp),
  );
  router.post(
    "/refresh-token",
    validateRefreshToken,
    asyncHandler(authController.refresh),
  );
  router.post("/logout", verifyToken, asyncHandler(authController.logout));

  // Password reset routes
  router.post(
    "/forgot-password",
    passwordResetLimiter,
    validateForgotPassword,
    asyncHandler(authController.forgotPassword),
  );
  router.post(
    "/reset-password",
    passwordResetLimiter,
    validateResetPassword,
    asyncHandler(authController.resetPassword),
  );

  return router;
}

module.exports = {
  createAuthRoutes,
};
