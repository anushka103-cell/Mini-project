const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");

function createRecommendationRoutes(recommendationController, verifyToken) {
  const router = express.Router();

  // POST /api/recommendations — get personalised coping strategies
  router.post(
    "/recommendations",
    verifyToken,
    asyncHandler(recommendationController.getRecommendations),
  );

  // POST /api/recommendations/feedback — thumbs up/down on a strategy
  router.post(
    "/recommendations/feedback",
    verifyToken,
    asyncHandler(recommendationController.submitFeedback),
  );

  // GET /api/recommendations/strategies?emotion=&category= — browse library
  router.get(
    "/recommendations/strategies",
    verifyToken,
    asyncHandler(recommendationController.listStrategies),
  );

  // GET /api/recommendations/strategies/:id — single strategy detail
  router.get(
    "/recommendations/strategies/:id",
    verifyToken,
    asyncHandler(recommendationController.getStrategy),
  );

  // GET /api/recommendations/emotions — supported emotions list
  router.get(
    "/recommendations/emotions",
    verifyToken,
    asyncHandler(recommendationController.getEmotions),
  );

  // GET /api/recommendations/categories — strategy categories
  router.get(
    "/recommendations/categories",
    verifyToken,
    asyncHandler(recommendationController.getCategories),
  );

  return router;
}

module.exports = { createRecommendationRoutes };
