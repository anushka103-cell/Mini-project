const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");

function createMoodRoutes(moodController, verifyToken) {
  const router = express.Router();

  // POST /api/moods/log — log today's mood
  router.post("/moods/log", verifyToken, asyncHandler(moodController.logMood));

  // GET /api/moods/logs?days=N — mood history
  router.get("/moods/logs", verifyToken, asyncHandler(moodController.getLogs));

  // GET /api/moods/trends?days=N — trend analysis
  router.get(
    "/moods/trends",
    verifyToken,
    asyncHandler(moodController.getTrends),
  );

  // GET /api/moods/weekly-score — current week score
  router.get(
    "/moods/weekly-score",
    verifyToken,
    asyncHandler(moodController.getWeeklyScore),
  );

  // GET /api/moods/visualization?days=N — chart-ready data
  router.get(
    "/moods/visualization",
    verifyToken,
    asyncHandler(moodController.getVisualization),
  );

  // GET /api/moods/patterns?days=N — day-of-week/time-of-day analysis
  router.get(
    "/moods/patterns",
    verifyToken,
    asyncHandler(moodController.getPatterns),
  );

  // GET /api/moods/streaks — current and longest streak
  router.get(
    "/moods/streaks",
    verifyToken,
    asyncHandler(moodController.getStreaks),
  );

  // DELETE /api/moods/:id — delete a mood entry
  router.delete(
    "/moods/:id",
    verifyToken,
    asyncHandler(moodController.deleteMood),
  );

  // PATCH /api/moods/:id — update a mood entry
  router.patch(
    "/moods/:id",
    verifyToken,
    asyncHandler(moodController.updateMood),
  );

  // GET /api/moods/ai-reflection — AI-generated weekly reflection
  router.get(
    "/moods/ai-reflection",
    verifyToken,
    asyncHandler(moodController.getAiReflection),
  );

  return router;
}

module.exports = {
  createMoodRoutes,
};
