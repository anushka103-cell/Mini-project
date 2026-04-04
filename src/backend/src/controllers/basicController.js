function getRoot(_req, res) {
  res.json({ message: "MindSafe Backend Running" });
}

function getHealth(_req, res) {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getRoot,
  getHealth,
};
