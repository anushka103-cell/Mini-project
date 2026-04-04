const { createAuthRoutes } = require("./authRoutes");
const { createChatRoutes } = require("./chatRoutes");
const { createMoodRoutes } = require("./moodRoutes");
const { createAvatarRoutes } = require("./avatarRoutes");
const { createProfileRoutes } = require("./profileRoutes");
const { createGoogleAuthRoutes } = require("./googleAuthRoutes");
const {
  createRecommendationRoutes,
} = require("./recommendationRoutes");
const { createAnonSummaryRoutes } = require("./anonSummaryRoutes");
const {
  JWT_SECRET,
  FRONTEND_ORIGIN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
} = require("../config/env");

function mountRoutes(app, deps) {
  const {
    authController,
    authService,
    chatController,
    moodController,
    avatarController,
    profileController,
    recommendationController,
    verifyToken,
  } = deps;

  app.use("/api", createAuthRoutes(authController, verifyToken));
  app.use("/api", createChatRoutes(chatController, verifyToken));
  app.use("/api", createMoodRoutes(moodController, verifyToken));
  app.use("/api", createAvatarRoutes(avatarController, verifyToken));
  app.use("/api", createProfileRoutes(profileController, verifyToken));
  app.use(
    "/api",
    createRecommendationRoutes(recommendationController, verifyToken),
  );
  app.use(
    "/api",
    createGoogleAuthRoutes({
      authService,
      googleClientId: GOOGLE_CLIENT_ID,
      googleClientSecret: GOOGLE_CLIENT_SECRET,
      googleCallbackUrl: GOOGLE_CALLBACK_URL,
      frontendOrigin: FRONTEND_ORIGIN.split(",")[0].trim(),
    }),
  );
  app.use("/api", createAnonSummaryRoutes());
}

module.exports = {
  mountRoutes,
};
