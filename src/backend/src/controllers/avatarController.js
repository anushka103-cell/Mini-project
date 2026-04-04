function createAvatarController(userDataService) {
  return {
    async saveAvatar(req, res) {
      const { avatar3D } = req.body || {};
      const result = await userDataService.saveAvatar(req.user.id, avatar3D);
      return res.json(result);
    },

    async getAvatar(req, res) {
      const result = await userDataService.getAvatar(req.user.id);
      return res.json(result);
    },

    async savePreferences(req, res) {
      const prefs = req.body || {};
      const result = await userDataService.saveAvatarPreferences(
        req.user.id,
        prefs,
      );
      return res.json(result);
    },

    async getPreferences(req, res) {
      const result = await userDataService.getAvatarPreferences(req.user.id);
      return res.json(result);
    },
  };
}

module.exports = {
  createAvatarController,
};
