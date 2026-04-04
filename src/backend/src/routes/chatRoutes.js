const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateChatMessage } = require("../middleware/validators");

function createChatRoutes(chatController, verifyToken) {
  const router = express.Router();

  // Public warm-up endpoint — wakes the chatbot on Render free tier
  router.get(
    "/chatbot/health",
    asyncHandler(chatController.chatbotHealth),
  );

  router.post("/chatbot", verifyToken, asyncHandler(chatController.askChatbot));

  router.post(
    "/chat",
    verifyToken,
    validateChatMessage,
    asyncHandler(chatController.addMessage),
  );
  router.get("/chat", verifyToken, asyncHandler(chatController.getMessages));

  return router;
}

module.exports = {
  createChatRoutes,
};
