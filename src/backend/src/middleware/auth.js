const { sendError } = require("../utils/httpResponse");

function createVerifyToken({ tokenService, userStore }) {
  return async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendError(res, 401, "No token provided");
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return sendError(res, 401, "Invalid authorization header format");
    }

    try {
      const decoded = tokenService.verifyAccessToken(token);
      const user = await userStore.findUserById(decoded.sub);
      const session = await userStore.getSession(decoded.sid);

      if (
        !user ||
        !session ||
        session.userId !== user.id ||
        session.revokedAt
      ) {
        return sendError(res, 401, "Authentication session is invalid");
      }

      if (user.tokenVersion !== decoded.ver) {
        return sendError(res, 401, "Authentication token is no longer valid");
      }

      await userStore.updateSession(session.id, {});

      req.user = {
        id: user.id,
        anonymizedUserId: user.id,
        analyticsSubjectId: user.analyticsSubjectId,
        email: user.email,
        role: user.role,
        sessionId: session.id,
        scope: decoded.scope || [],
        privacy: user.privacy,
      };

      return next();
    } catch (error) {
      return sendError(res, 401, "Invalid or expired token");
    }
  };
}

module.exports = {
  createVerifyToken,
};
