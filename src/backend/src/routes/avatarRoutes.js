const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateAvatar } = require("../middleware/validators");

function createAvatarRoutes(avatarController, verifyToken) {
  const router = express.Router();

  router.post(
    "/avatar",
    verifyToken,
    validateAvatar,
    asyncHandler(avatarController.saveAvatar),
  );
  router.get("/avatar", verifyToken, asyncHandler(avatarController.getAvatar));

  // Avatar preferences
  router.post(
    "/avatar/preferences",
    verifyToken,
    asyncHandler(avatarController.savePreferences),
  );
  router.get(
    "/avatar/preferences",
    verifyToken,
    asyncHandler(avatarController.getPreferences),
  );

  return router;
}

module.exports = {
  createAvatarRoutes,
};
