const { sendError } = require("../utils/httpResponse");

function notFoundHandler(req, res) {
  return sendError(res, 404, "Route not found");
}

function errorHandler(err, _req, res, _next) {
  console.error("Unhandled API error:", err);

  if (res.headersSent) return;

  const status = err.status || 500;
  const message = status < 500 ? err.message : "Internal server error";

  return sendError(res, status, message);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
