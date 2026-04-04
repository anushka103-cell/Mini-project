function createProfileController(userDataService) {
  return {
    async upsertProfile(req, res) {
      const result = await userDataService.upsertProfile(
        req.user.id,
        req.body || {},
      );
      return res.json(result);
    },

    async getProfile(req, res) {
      const result = await userDataService.getProfile(
        req.user.id,
        req.user.email,
      );
      return res.json(result);
    },

    async deleteProfile(req, res) {
      const result = await userDataService.deleteAccount(req.user.id);
      return res.json(result);
    },
  };
}

module.exports = {
  createProfileController,
};
