function sendOk(res, body, status = 200) {
  return res.status(status).json(body);
}

function sendError(res, status, message, details) {
  return res.status(status).json({
    message,
    error: {
      message,
      status,
      details: details || undefined,
    },
  });
}

module.exports = {
  sendOk,
  sendError,
};
