const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EMAIL_VERIFICATION_SECRET,
  JWT_PASSWORD_RESET_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  EMAIL_VERIFICATION_TTL,
  PASSWORD_RESET_TTL,
  FRONTEND_ORIGIN,
  CHATBOT_SERVICE_URL,
  MOOD_ANALYTICS_URL,
  RECOMMENDATION_SERVICE_URL,
} = require("./config/env");
const userRepository = require("./repositories");
const { createVerifyToken } = require("./middleware/auth");
const { securityHeaders } = require("./middleware/securityHeaders");
const {
  createDecryptEnvelopeMiddleware,
} = require("./middleware/decryptEnvelopes");
const { createAuthService } = require("./services/authService");
const { createTokenService } = require("./utils/tokenService");
const userDataService = require("./services/userDataService");
const { createAuthController } = require("./controllers/authController");
const { createChatController } = require("./controllers/chatController");
const { createMoodController } = require("./controllers/moodController");
const { createAvatarController } = require("./controllers/avatarController");
const { createProfileController } = require("./controllers/profileController");
const {
  createRecommendationController,
} = require("./controllers/recommendationController");
const basicController = require("./controllers/basicController");
const { mountRoutes } = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandlers");
const { apiLimiter } = require("./middleware/rateLimiter");
const { sanitizeInput } = require("./middleware/sanitize");
const { createSmsProvider } = require("./services/smsProvider");
const { seedUsers } = require("../seed");

async function createApp() {
  // Initialize repository (sets up database if PostgreSQL is enabled)
  await userRepository.initialize();

  // Seed default users only in development (skips if they already exist)
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.FORCE_SEED === "true"
  ) {
    await seedUsers(userRepository);
  }

  const app = express();
  const allowedOrigins = FRONTEND_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false, // handled by frontend / nginx
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(securityHeaders);
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Origin is not allowed by CORS"));
      },
    }),
  );
  app.use(express.json({ limit: "250kb" }));
  app.use(sanitizeInput);
  app.use("/api", apiLimiter);

  const tokenService = createTokenService({
    accessSecret: JWT_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
    emailVerificationSecret: JWT_EMAIL_VERIFICATION_SECRET,
    passwordResetSecret: JWT_PASSWORD_RESET_SECRET,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    accessTokenTtl: ACCESS_TOKEN_TTL,
    refreshTokenTtl: REFRESH_TOKEN_TTL,
    emailVerificationTtl: EMAIL_VERIFICATION_TTL,
    passwordResetTtl: PASSWORD_RESET_TTL,
  });

  const verifyToken = createVerifyToken({
    tokenService,
    userStore: userRepository,
  });

  const authService = createAuthService({
    tokenService,
    resendApiKey: process.env.RESEND_API_KEY,
    appUrl: allowedOrigins[0] || "http://localhost:3000",
    emailFrom: process.env.EMAIL_FROM,
    smsProvider: createSmsProvider(),
  });

  const authController = createAuthController(authService);
  const chatController = createChatController(userDataService, {
    chatbotServiceUrl: CHATBOT_SERVICE_URL,
  });
  const moodController = createMoodController({
    moodAnalyticsUrl: MOOD_ANALYTICS_URL,
  });
  const avatarController = createAvatarController(userDataService);
  const profileController = createProfileController(userDataService);
  const recommendationController = createRecommendationController({
    recommendationServiceUrl: RECOMMENDATION_SERVICE_URL,
  });

  app.get("/", basicController.getRoot);
  app.get("/health", basicController.getHealth);

  // Add decryption middleware for client-encrypted envelopes (after auth)
  app.use("/api", createDecryptEnvelopeMiddleware(userRepository));

  mountRoutes(app, {
    authController,
    authService,
    chatController,
    moodController,
    avatarController,
    profileController,
    recommendationController,
    verifyToken,
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    socketCorsOrigin: FRONTEND_ORIGIN.split(",")[0].trim(),
  };
}

module.exports = {
  createApp,
};
