const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateProfilePatch } = require("../middleware/validators");

function createProfileRoutes(profileController, verifyToken) {
  const router = express.Router();

  router.post(
    "/profile",
    verifyToken,
    validateProfilePatch,
    asyncHandler(profileController.upsertProfile),
  );
  router.get(
    "/profile",
    verifyToken,
    asyncHandler(profileController.getProfile),
  );
  router.delete(
    "/profile",
    verifyToken,
    asyncHandler(profileController.deleteProfile),
  );

  return router;
}

module.exports = {
  createProfileRoutes,
};
