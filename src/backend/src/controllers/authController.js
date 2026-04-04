function createAuthController(authService) {
  function buildMetadata(req) {
    return {
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "unknown",
    };
  }

  return {
    async register(req, res) {
      const result = await authService.register(req.body || {});
      return res.status(result.status).json(result.body);
    },

    async requestEmailVerification(req, res) {
      const result = await authService.requestEmailVerification(req.user.id);
      return res.status(result.status).json(result.body);
    },

    async verifyEmail(req, res) {
      const { token } = req.body || {};
      const result = await authService.verifyEmail(token);
      return res.status(result.status).json(result.body);
    },

    async login(req, res) {
      const result = await authService.login({
        ...(req.body || {}),
        metadata: buildMetadata(req),
      });
      return res.status(result.status).json(result.body);
    },

    async requestMobileOtp(req, res) {
      const result = await authService.requestMobileOtp(req.body || {});
      return res.status(result.status).json(result.body);
    },

    async loginWithMobileOtp(req, res) {
      const result = await authService.loginWithMobileOtp({
        ...(req.body || {}),
        metadata: buildMetadata(req),
      });
      return res.status(result.status).json(result.body);
    },

    async verifyMobileOtp(req, res) {
      const result = await authService.verifyMobileOtp({
        userId: req.user.id,
        ...(req.body || {}),
      });
      return res.status(result.status).json(result.body);
    },

    async refresh(req, res) {
      const result = await authService.refreshSession({
        refreshToken: req.body?.refreshToken,
        metadata: buildMetadata(req),
      });
      return res.status(result.status).json(result.body);
    },

    async logout(req, res) {
      const result = await authService.logout(req.user.sessionId);
      return res.status(result.status).json(result.body);
    },

    async forgotPassword(req, res) {
      const result = await authService.forgotPassword(req.body || {});
      return res.status(result.status).json(result.body);
    },

    async resetPassword(req, res) {
      const result = await authService.resetPassword(req.body || {});
      return res.status(result.status).json(result.body);
    },
  };
}

module.exports = {
  createAuthController,
};
